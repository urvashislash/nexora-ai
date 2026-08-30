import os
import re
import pytest

def test_database_schema_migrations_ordered():
    """
    Regression test to ensure database migrations are ordered correctly and do not contain conflicts.
    """
    migrations_dir = os.path.join(os.path.dirname(__file__), "../../database/migrations")
    
    if not os.path.exists(migrations_dir):
        pytest.skip(f"Migrations directory {migrations_dir} not found.")
        
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])
    
    # Check that migrations start with sequential numbers
    for i, file_name in enumerate(migration_files):
        expected_prefix = f"{i+1:03d}"
        assert file_name.startswith(expected_prefix), f"Migration {file_name} is out of order. Expected prefix {expected_prefix}."

def test_no_destructive_schema_changes():
    """
    Regression test to ensure migrations don't contain destructive commands 
    (like DROP TABLE) without explicit safeguards, which could cause data loss.
    """
    migrations_dir = os.path.join(os.path.dirname(__file__), "../../database/migrations")
    
    if not os.path.exists(migrations_dir):
        pytest.skip(f"Migrations directory {migrations_dir} not found.")
        
    migration_files = [f for f in os.listdir(migrations_dir) if f.endswith(".sql")]
    
    destructive_commands = ["DROP TABLE", "DROP DATABASE", "TRUNCATE"]
    
    for file_name in migration_files:
        file_path = os.path.join(migrations_dir, file_name)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().upper()
            
            for cmd in destructive_commands:
                # We allow 'DROP TABLE IF EXISTS' in some cases, but generally want to flag bare 'DROP TABLE'
                # This is a simplified check
                occurrences = len(re.findall(r'\b' + cmd + r'\b', content))
                # For safety, we assert 0 occurrences or if there is a known exception, we'd handle it here.
                # In our schema, we should not have destructive commands.
                assert occurrences == 0, f"Destructive command '{cmd}' found in {file_name}. This is not allowed in production."
