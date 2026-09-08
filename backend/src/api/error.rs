use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

// =============================================================================
// Structured API Error
// =============================================================================

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let status = match self.code.as_str() {
            "NOT_FOUND" => StatusCode::NOT_FOUND,
            "CONFLICT" => StatusCode::CONFLICT,
            "VALIDATION_ERROR" | "BAD_REQUEST" => StatusCode::BAD_REQUEST,
            "FORBIDDEN" => StatusCode::FORBIDDEN,
            "UNAUTHORIZED" => StatusCode::UNAUTHORIZED,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(self)).into_response()
    }
}

impl ApiError {
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "NOT_FOUND".to_string(),
            details: None,
        }
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "BAD_REQUEST".to_string(),
            details: None,
        }
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "CONFLICT".to_string(),
            details: None,
        }
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "VALIDATION_ERROR".to_string(),
            details: None,
        }
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "UNAUTHORIZED".to_string(),
            details: None,
        }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            code: "INTERNAL_ERROR".to_string(),
            details: None,
        }
    }
}
