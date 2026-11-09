//! Read-only view of DeepSeek Harness session logs for the island's DSH page.

use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const ZSTD_MAGIC: [u8; 4] = [0x28, 0xb5, 0x2f, 0xfd];
const SUMMARY_FRAMES: usize = 160;
const MESSAGE_FRAMES: usize = 400;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DshSessionSummary {
    pub id: String,
    pub title: String,
    pub model: String,
    pub updated_at: i64,
    pub last_user: String,
    pub last_tool: String,
    pub pending: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DshMessage {
    pub role: String,
    pub text: String,
    pub time: i64,
}

fn sessions_root() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE")?;
    Some(PathBuf::from(home).join(".dsh").join("sessions"))
}

fn modified_millis(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0)
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0)
}

/// Session logs are stored as appended zstd frames; decode only the tail we need.
fn decode_tail(path: &Path, max_frames: usize) -> String {
    decode_range(path, max_frames, 16)
}

/// 解出尾部若干帧（最新记录），并附带最前面的少量帧（标题等早期记录）。
fn decode_range(path: &Path, tail_frames: usize, head_frames: usize) -> String {
    let Ok(bytes) = fs::read(path) else {
        return String::new();
    };
    let mut offsets = Vec::new();
    let mut index = 0;
    while index + 4 <= bytes.len() {
        if bytes[index..index + 4] == ZSTD_MAGIC {
            offsets.push(index);
            index += 4;
        } else {
            index += 1;
        }
    }
    if offsets.is_empty() {
        return String::new();
    }
    let start = offsets.len().saturating_sub(tail_frames);
    let mut text = String::new();
    let head_end = head_frames.min(start);
    let mut positions: Vec<usize> = (0..head_end).collect();
    positions.extend(start..offsets.len());
    for position in positions {
        let begin = offsets[position];
        let end = offsets.get(position + 1).copied().unwrap_or(bytes.len());
        if let Ok(mut decoder) = zstd::stream::read::Decoder::new(&bytes[begin..end]) {
            let mut buffer = Vec::new();
            if decoder.read_to_end(&mut buffer).is_ok() {
                text.push_str(&String::from_utf8_lossy(&buffer));
            }
        }
    }
    text
}

fn assistant_text(value: &serde_json::Value) -> String {
    let Some(items) = value.as_array() else {
        return String::new();
    };
    let mut parts = Vec::new();
    for item in items {
        if item.get("type").and_then(|kind| kind.as_str()) == Some("text") {
            if let Some(text) = item.get("text").and_then(|text| text.as_str()) {
                parts.push(text.to_string());
            }
        }
    }
    parts.join(" ")
}
fn is_injected(text: &str) -> bool {
    let trimmed = text.trim_start();
    trimmed.starts_with("Time sampled")
        || trimmed.starts_with("Current runtime context")
        || trimmed.starts_with("Browser time zone")
        || trimmed.starts_with("Tokens prefixed")
        || trimmed.starts_with("<")
        || trimmed.starts_with("background job ")
}
fn text_from_content(value: &serde_json::Value) -> String {
    let Some(items) = value.as_array() else {
        return value.as_str().unwrap_or_default().to_string();
    };
    let mut parts = Vec::new();
    for item in items {
        match item.get("type").and_then(|kind| kind.as_str()) {
            Some("text") => {
                if let Some(text) = item.get("text").and_then(|text| text.as_str()) {
                    parts.push(text.to_string());
                }
            }
            Some("tool_use") => {
                if let Some(name) = item.get("name").and_then(|name| name.as_str()) {
                    parts.push(format!("[{name}]"));
                }
            }
            _ => {}
        }
    }
    parts.join(" ")
}

fn summarize(path: &Path, id: &str, updated_at: i64, pending: bool) -> DshSessionSummary {
    let text = decode_tail(path, SUMMARY_FRAMES);
    let mut title = String::new();
    let mut model = String::new();
    let mut last_user = String::new();
    let mut last_tool = String::new();
    for line in text.lines() {
        let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let kind = record.get("type").and_then(|kind| kind.as_str()).unwrap_or_default();
        let data = record.get("data").cloned().unwrap_or(serde_json::Value::Null);
        match kind {
            "session/title" => {
                if let Some(value) = data.get("title").and_then(|value| value.as_str()) {
                    title = value.to_string();
                }
            }
            "model/selection" => {
                if let Some(value) = data.get("model").and_then(|value| value.as_str()) {
                    model = value.to_string();
                }
            }
            "user/message" => {
                let content = data.get("content").cloned().unwrap_or(serde_json::Value::Null);
                let value = text_from_content(&content);
                if !value.is_empty() && !is_injected(&value) {
                    last_user = value;
                }
            }
            "tool/call" => {
                if let Some(value) = data.get("name").and_then(|value| value.as_str()) {
                    last_tool = value.to_string();
                }
            }
            _ => {}
        }
    }
    if title.is_empty() {
        title = if last_user.is_empty() {
            id.to_string()
        } else {
            last_user.chars().take(24).collect()
        };
    }
    DshSessionSummary {
        id: id.to_string(),
        title,
        model,
        updated_at,
        last_user: last_user.chars().take(120).collect(),
        last_tool,
        pending,
    }
}

fn session_files() -> Vec<(PathBuf, String, i64)> {
    let Some(root) = sessions_root() else {
        return Vec::new();
    };
    let Ok(workspaces) = fs::read_dir(&root) else {
        return Vec::new();
    };
    let mut files = Vec::new();
    for workspace in workspaces.flatten() {
        let Ok(sessions) = fs::read_dir(workspace.path()) else {
            continue;
        };
        for session in sessions.flatten() {
            let Ok(entries) = fs::read_dir(session.path()) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|ext| ext.to_str()) != Some("zstd") {
                    continue;
                }
                let id = path
                    .file_stem()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default()
                    .to_string();
                files.push((path.clone(), id, modified_millis(&path)));
            }
        }
    }
    files.sort_by(|left, right| right.2.cmp(&left.2));
    files
}

#[tauri::command]
pub fn read_dsh_sessions(limit: usize) -> Vec<DshSessionSummary> {
    let limit = limit.clamp(1, 10);
    let now = now_millis();
    session_files()
        .into_iter()
        .take(limit)
        .map(|(path, id, updated_at)| {
            let pending = now.saturating_sub(updated_at) < 20_000;
            summarize(&path, &id, updated_at, pending)
        })
        .collect()
}

#[tauri::command]
pub fn read_dsh_messages(session_id: String, limit: usize) -> Vec<DshMessage> {
    let limit = limit.clamp(1, 50);
    let Some((path, ..)) = session_files()
        .into_iter()
        .find(|(_, id, _)| id == &session_id)
    else {
        return Vec::new();
    };
    let text = decode_tail(&path, MESSAGE_FRAMES);
    let mut messages: Vec<DshMessage> = Vec::new();
    for line in text.lines() {
        let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let kind = record.get("type").and_then(|kind| kind.as_str()).unwrap_or_default();
        let time = record.get("time").and_then(|value| value.as_i64()).unwrap_or(0);
        let data = record.get("data").cloned().unwrap_or(serde_json::Value::Null);
        match kind {
            "user/message" => {
                let content = data.get("content").cloned().unwrap_or(serde_json::Value::Null);
                let value = text_from_content(&content);
                if !value.trim().is_empty() && !is_injected(&value) {
                    messages.push(DshMessage {
                        role: "user".to_string(),
                        text: value.chars().take(600).collect(),
                        time,
                    });
                }
            }
            "assistant/message" => {
                let inner = data.get("message").cloned().unwrap_or(serde_json::Value::Null);
                let content = inner.get("content").cloned().unwrap_or(serde_json::Value::Null);
                let value = text_from_content(&content);
                if !value.trim().is_empty() {
                    messages.push(DshMessage {
                        role: "assistant".to_string(),
                        text: value.chars().take(600).collect(),
                        time,
                    });
                }
            }
            "tool/call" => {
                if let Some(value) = data.get("name").and_then(|value| value.as_str()) {
                    messages.push(DshMessage {
                        role: "tool".to_string(),
                        text: value.to_string(),
                        time,
                    });
                }
            }
            _ => {}
        }
    }
    let start = messages.len().saturating_sub(limit);
    messages.split_off(start)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DshTurn {
    pub time: i64,
    pub user: String,
    pub assistant: String,
    #[serde(skip)]
    pub visible: bool,
}

fn newest_session_file() -> Option<(PathBuf, String, i64)> {
    session_files().into_iter().next()
}

/// 当前会话最近若干"回合"：一次提问 + 一次回答。
#[tauri::command]
pub fn read_dsh_turns(limit: usize) -> Vec<DshTurn> {
    let limit = limit.clamp(1, 30);
    let Some((path, ..)) = newest_session_file() else {
        return Vec::new();
    };
    let text = decode_tail(&path, MESSAGE_FRAMES);
    let mut turns: Vec<DshTurn> = Vec::new();
    for line in text.lines() {
        let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let kind = record.get("type").and_then(|kind| kind.as_str()).unwrap_or_default();
        let time = record.get("time").and_then(|value| value.as_i64()).unwrap_or(0);
        let data = record.get("data").cloned().unwrap_or(serde_json::Value::Null);
        match kind {
            "user/message" => {
                let content = data.get("content").cloned().unwrap_or(serde_json::Value::Null);
                let value = text_from_content(&content);
                // 每条 user 消息都开启一个新回合；注入类消息只占位，最后剔除，
                // 这样后续的 assistant 回复不会被错挂到上一个真人回合上。
                let visible = !is_injected(&value);
                turns.push(DshTurn { time, user: value, assistant: String::new(), visible });
            }
            "assistant/message" => {
                let Some(current) = turns.last_mut() else {
                    continue;
                };
                let inner = data.get("message").cloned().unwrap_or(serde_json::Value::Null);
                let content = inner.get("content").cloned().unwrap_or(serde_json::Value::Null);
                let value = assistant_text(&content);
                if !value.trim().is_empty() {
                    if !current.assistant.is_empty() {
                        current.assistant.push(' ');
                    }
                    current.assistant.push_str(value.trim());
                }
            }
            _ => {}
        }
    }
    let mut visible: Vec<DshTurn> = turns.into_iter().filter(|turn| turn.visible && !turn.user.trim().is_empty()).collect();
    let start = visible.len().saturating_sub(limit);
    visible.split_off(start)
}