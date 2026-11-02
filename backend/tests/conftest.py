"""Each test migrates a unique PostgreSQL schema, never the application tables."""
import os
from pathlib import Path
from uuid import uuid4
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def connection():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.fail('Set TEST_DATABASE_URL to a PostgreSQL database where the test user may create schemas.')
    engine = create_engine(url)
    assert engine.dialect.name == 'postgresql', 'Tests require PostgreSQL'
    schema = 'test_' + uuid4().hex
    with engine.connect() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA {schema}')
        conn.exec_driver_sql(f'SET search_path TO {schema}')
        conn.commit()
        config = Config(str(Path(__file__).parents[1] / 'alembic.ini'))
        config.attributes['connection'] = conn
        try:
            command.upgrade(config, 'head')
            command.check(config)
            yield conn
            conn.rollback()
            command.downgrade(config, 'base')
        finally:
            conn.rollback()
            conn.exec_driver_sql('SET search_path TO public')
            conn.exec_driver_sql(f'DROP SCHEMA {schema} CASCADE')
            conn.commit()
    engine.dispose()


@pytest.fixture
def session(connection):
    with Session(connection) as session:
        yield session
        session.rollback()
