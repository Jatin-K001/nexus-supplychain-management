import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv(Path(__file__).resolve().parents[3] / '.env')


def get_conn():
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ.get('DB_PORT', 5432)),
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        dbname=os.environ.get('DB_NAME', 'postgres'),
        sslmode='require',
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
