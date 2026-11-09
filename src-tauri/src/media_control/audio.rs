//! Default render endpoint: master volume and the output peak meter.

use windows::Win32::{
    Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation},
    Media::Audio::{
        eCommunications, eConsole, eMultimedia, eRender, AudioSessionStateActive,
        IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator,
    },
    System::Com::{CoCreateInstance, CLSCTX_ALL},
    System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    },
};
use std::path::Path;
use windows::core::Interface;

use super::session::media_error;

pub(super) const AUDIO_ACTIVE_THRESHOLD: f32 = 0.01;

pub(super) fn read_master_volume() -> Option<f32> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .ok()?;
        let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
        let level = endpoint.GetMasterVolumeLevelScalar().ok()?;
        Some(level.clamp(0.0, 1.0))
    }
}

pub(super) fn set_master_volume(level: f32) -> Result<(), String> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| {
                media_error("Failed to open the Windows audio device manager", error)
            })?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|error| media_error("Failed to open the default audio output", error))?;
        let endpoint: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|error| media_error("Failed to open the audio volume control", error))?;
        endpoint
            .SetMasterVolumeLevelScalar(level.clamp(0.0, 1.0), std::ptr::null())
            .map_err(|error| media_error("Failed to change the system volume", error))?;
        Ok(())
    }
}

pub(super) fn read_system_audio_peak() -> Result<f32, String> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| {
                media_error("Failed to open the Windows audio device manager", error)
            })?;
        let mut peak = 0.0_f32;
        let mut found_meter = false;

        for role in [eMultimedia, eConsole, eCommunications] {
            if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, role) {
                if let Ok(meter) = device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) {
                    found_meter = true;
                    if let Ok(value) = meter.GetPeakValue() {
                        peak = peak.max(value);
                    }
                }
            }
        }

        if found_meter {
            Ok(peak.clamp(0.0, 1.0))
        } else {
            Err("No default Windows audio output was available.".to_string())
        }
    }
}
/// 读取当前正在出声的进程名（例如 douyin.exe）。
/// 抖音这类应用不一定会向系统注册媒体会话，只能从音频会话里找。
pub(super) fn read_audio_source_app() -> Option<String> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .ok()?;
        let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None).ok()?;
        let sessions = manager.GetSessionEnumerator().ok()?;
        let count = sessions.GetCount().ok()?;

        let mut names: Vec<String> = Vec::new();
        for index in 0..count {
            let Ok(control) = sessions.GetSession(index) else {
                continue;
            };
            let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
                continue;
            };
            if control2.GetState().ok() != Some(AudioSessionStateActive) {
                continue;
            }
            let Ok(pid) = control2.GetProcessId() else {
                continue;
            };
            if pid == 0 {
                continue;
            }
            if let Some(name) = process_file_name(pid) {
                names.push(name);
            }
        }

        let known = [
            "douyin", "cloudmusic", "qqmusic", "wechat", "weixin", "kugou", "spotify", "qq",
        ];
        names
            .iter()
            .find(|name| known.iter().any(|token| name.contains(token)))
            .cloned()
            .or_else(|| names.first().cloned())
    }
}

unsafe fn process_file_name(pid: u32) -> Option<String> {
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buffer = [0u16; 512];
    let mut size = buffer.len() as u32;
    if QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, windows::core::PWSTR(buffer.as_mut_ptr()), &mut size).is_err() {
        return None;
    }
    let path = String::from_utf16_lossy(&buffer[..size as usize]);
    Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().to_ascii_lowercase())
}