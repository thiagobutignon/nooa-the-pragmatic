use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct DesktopActionRequest {
    request_id: String,
    kind: String,
    path: String,
    content: Option<String>,
    reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum DesktopEvent {
    Assistant {
        markdown: String,
    },
    User {
        markdown: String,
    },
    ToolRead {
        path: String,
        bytes: u64,
        preview: String,
    },
    ToolWrite {
        path: String,
        bytes: u64,
    },
    ToolDelete {
        path: String,
    },
    ApprovalRequested {
        request: DesktopActionRequest,
    },
    ApprovalResolved {
        request_id: String,
        approved: bool,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum DesktopPermissionMode {
    FullAccess,
    AskFirst,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum DesktopBridgeRequest {
    SendMessage {
        session_id: String,
        workspace_path: String,
        mode: DesktopPermissionMode,
        message: String,
    },
    Approve {
        session_id: String,
        workspace_path: String,
        mode: DesktopPermissionMode,
    },
    Deny {
        session_id: String,
        workspace_path: String,
        mode: DesktopPermissionMode,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct DesktopBridgeResponse {
    session_id: String,
    workspace_path: String,
    mode: DesktopPermissionMode,
    events: Vec<DesktopEvent>,
}

fn repo_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .join("../../..")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve repo root: {error}"))
}

fn bridge_script_path(repo_root: &Path) -> PathBuf {
    repo_root.join("src/runtime/desktop/bridge.ts")
}

fn run_bridge_process(request: &DesktopBridgeRequest) -> Result<DesktopBridgeResponse, String> {
    let repo_root = repo_root()?;
    let bridge_path = bridge_script_path(&repo_root);
    let payload = serde_json::to_vec(request)
        .map_err(|error| format!("Failed to encode request: {error}"))?;

    let mut child = Command::new("bun")
        .arg(bridge_path)
        .current_dir(&repo_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start desktop bridge: {error}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(&payload)
            .and_then(|_| stdin.write_all(b"\n"))
            .map_err(|error| format!("Failed to send bridge request: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Desktop bridge failed to finish: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Desktop bridge failed: {}", stderr.trim()));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to decode desktop bridge response: {error}"))
}

#[tauri::command]
async fn desktop_bridge(request: DesktopBridgeRequest) -> Result<DesktopBridgeResponse, String> {
    tauri::async_runtime::spawn_blocking(move || run_bridge_process(&request))
        .await
        .map_err(|error| format!("Desktop bridge task failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![desktop_bridge])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
