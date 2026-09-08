use serde::Deserialize;
use uuid::Uuid;

/// Default reviewer UUID used when no reviewer_id is provided.
pub fn default_reviewer_id() -> Uuid {
    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap_or_else(|_| Uuid::nil())
}

/// Parses a string as UUID, or derives a deterministic UUID v4-shaped value via SHA-256.
pub fn parse_uuid_or_derive(id_str: &str) -> Uuid {
    if let Ok(u) = Uuid::parse_str(id_str) {
        return u;
    }
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(id_str.as_bytes());
    let hash = hasher.finalize();
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&hash[0..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}

/// Custom deserializer: treats empty strings as None when deserializing Option<Uuid>.
pub fn empty_string_is_none<'de, D>(deserializer: D) -> Result<Option<Uuid>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    match opt.as_deref() {
        None | Some("") => Ok(None),
        Some(s) => Ok(Some(parse_uuid_or_derive(s))),
    }
}

/// Custom deserializer: parses Vec<String> as Vec<Uuid>, deriving UUIDs for non-parseable strings.
pub fn deserialize_string_or_uuid_vec<'de, D>(deserializer: D) -> Result<Vec<Uuid>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let list = Vec::<String>::deserialize(deserializer)?;
    Ok(list.into_iter().map(|s| parse_uuid_or_derive(&s)).collect())
}

/// Query parameters for paginated list endpoints.
#[derive(Debug, Deserialize, Clone, Copy, Default)]
pub struct PaginationParams {
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

impl PaginationParams {
    /// Applies pagination offset and limit to a slice.
    /// If limit is omitted, returns all items starting from page offset.
    pub fn apply<T: Clone>(&self, items: &[T]) -> Vec<T> {
        let page = self.page.unwrap_or(1).max(1);
        let limit = self.limit.unwrap_or(items.len());
        let offset = (page - 1) * limit;
        items.iter().skip(offset).take(limit).cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_defaults() {
        let items = vec![1, 2, 3, 4, 5];
        let params = PaginationParams::default();
        assert_eq!(params.apply(&items), vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_pagination_page_and_limit() {
        let items = vec![10, 20, 30, 40, 50];
        let p1 = PaginationParams {
            page: Some(1),
            limit: Some(2),
        };
        assert_eq!(p1.apply(&items), vec![10, 20]);

        let p2 = PaginationParams {
            page: Some(2),
            limit: Some(2),
        };
        assert_eq!(p2.apply(&items), vec![30, 40]);

        let p3 = PaginationParams {
            page: Some(3),
            limit: Some(2),
        };
        assert_eq!(p3.apply(&items), vec![50]);

        let p4 = PaginationParams {
            page: Some(4),
            limit: Some(2),
        };
        assert_eq!(p4.apply(&items), Vec::<i32>::new());
    }
}
