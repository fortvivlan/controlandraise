from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

def get_db():
    conn = sqlite3.connect('grant_database.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_language_columns():
    """Get list of language columns dynamically from database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        # SQLite syntax for getting column names
        cursor.execute("PRAGMA table_info(questions)")
        columns = cursor.fetchall()
        languages = [col[1] for col in columns if col[1] not in ('id', 'question_number', 'group_id', 'question_text')]
        conn.close()
        return sorted(languages)
    except:
        # Fallback to original languages if query fails
        return ['bulgarian', 'danish', 'greben', 'muira', 'nanai', 'nganasan', 'nornakhichevan', 'polish', 'russian', 'udmurt', 'westcircassian']

@app.route('/')
def index():
    """API documentation."""
    return jsonify({
        'name': 'Grant Database API',
        'version': '1.0',
        'endpoints': {
            '/api/languages': 'Get available languages',
            '/api/groups': 'Get all groups with question counts',
            '/api/questions/group/<group_number>': 'Get all questions in a group',
            '/api/questions/random/<group_number>': 'Get random question(s) from a group',
            '/api/questions/<question_number>': 'Get specific question by number',
            '/api/search?q=<query>': 'Search questions and answers',
            '/api/stats': 'Get database statistics'
        }
    })

@app.route('/api/languages')
def get_languages():
    """Get list of available languages."""
    try:
        languages = get_language_columns()
        return jsonify({
            'languages': languages,
            'count': len(languages)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/groups')
def get_groups():
    """Get all groups with names and question counts."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                g.group_number,
                g.group_name,
                COUNT(q.id) as question_count
            FROM groups g
            LEFT JOIN questions q ON g.id = q.group_id
            GROUP BY g.group_number, g.group_name
            ORDER BY CAST(g.group_number AS INTEGER)
        """)
        groups = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/questions/group/<group_number>')
def get_group_questions(group_number):
    """Get all questions in a specific group with group information."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get group info
        cursor.execute("""
            SELECT group_number, group_name
            FROM groups
            WHERE group_number = ?
        """, (group_number,))
        group_info = cursor.fetchone()
        
        if not group_info:
            conn.close()
            return jsonify({'error': 'Group not found'}), 404
        
        # Get questions in this group with group info
        cursor.execute("""
            SELECT q.*, g.group_number, g.group_name
            FROM questions q
            JOIN groups g ON q.group_id = g.id
            WHERE g.group_number = ? 
            ORDER BY CAST(SUBSTR(q.question_number, 1, INSTR(q.question_number, '.') - 1) AS INTEGER),
                     CAST(SUBSTR(q.question_number, INSTR(q.question_number, '.') + 1) AS INTEGER)
        """, (group_number,))
        questions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'group': dict(group_info),
            'questions': questions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/questions/random/<group_number>')
def get_random_question(group_number):
    """Get random question(s) from a group."""
    # Get count parameter (default 1)
    count = request.args.get('count', 1, type=int)
    count = min(count, 50)  # Limit to 50 questions max
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT q.*, g.group_number, g.group_name
            FROM questions q
            JOIN groups g ON q.group_id = g.id
            WHERE g.group_number = ? 
            ORDER BY RANDOM() 
            LIMIT ?
        """, (group_number, count))
        questions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        if not questions:
            return jsonify({'error': 'Group not found'}), 404
            
        return jsonify(questions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/questions/<question_number>')
def get_question(question_number):
    """Get a specific question by its number."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT q.*, g.group_number, g.group_name
            FROM questions q
            JOIN groups g ON q.group_id = g.id
            WHERE q.question_number = ?
        """, (question_number,))
        question = cursor.fetchone()
        conn.close()
        
        if not question:
            return jsonify({'error': 'Question not found'}), 404
            
        return jsonify(dict(question))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search_questions():
    """Search across all questions and answers."""
    query = request.args.get('q', '')
    language = request.args.get('lang', 'all')
    
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get available languages
        languages = get_language_columns()
        
        # Build search query based on language
        if language == 'all':
            # Search across question_text and all language columns
            where_clauses = ['q.question_text LIKE ?'] + [f'q.{lang} LIKE ?' for lang in languages]
            search_sql = f"""
                SELECT q.*, g.group_number, g.group_name
                FROM questions q
                JOIN groups g ON q.group_id = g.id
                WHERE {' OR '.join(where_clauses)}
                ORDER BY CAST(SUBSTR(q.question_number, 1, INSTR(q.question_number, '.') - 1) AS INTEGER),
                         CAST(SUBSTR(q.question_number, INSTR(q.question_number, '.') + 1) AS INTEGER)
                LIMIT 100
            """
            search_pattern = f'%{query}%'
            cursor.execute(search_sql, (search_pattern,) * (len(languages) + 1))
        else:
            # Search in specific language
            valid_languages = ['question_text'] + languages
            if language not in valid_languages:
                return jsonify({'error': f'Invalid language. Use: {", ".join(valid_languages)}'}), 400
            
            search_sql = f"""
                SELECT q.*, g.group_number, g.group_name
                FROM questions q
                JOIN groups g ON q.group_id = g.id
                WHERE q.{language} LIKE ?
                ORDER BY CAST(SUBSTR(q.question_number, 1, INSTR(q.question_number, '.') - 1) AS INTEGER),
                         CAST(SUBSTR(q.question_number, INSTR(q.question_number, '.') + 1) AS INTEGER)
                LIMIT 100
            """
            cursor.execute(search_sql, (f'%{query}%',))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'query': query,
            'language': language,
            'count': len(results),
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get database statistics."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Total questions
        cursor.execute("SELECT COUNT(*) as total FROM questions")
        total = cursor.fetchone()['total']
        
        # Total groups
        cursor.execute("SELECT COUNT(*) as total FROM groups")
        total_groups = cursor.fetchone()['total']
        
        # Questions by group with names
        cursor.execute("""
            SELECT 
                g.group_number,
                g.group_name,
                COUNT(q.id) as count
            FROM groups g
            LEFT JOIN questions q ON g.id = q.group_id
            GROUP BY g.group_number, g.group_name
            ORDER BY CAST(g.group_number AS INTEGER)
        """)
        by_group = [dict(row) for row in cursor.fetchall()]
        
        # Get available languages
        languages = get_language_columns()
        
        # Build dynamic query for complete responses
        if languages:
            conditions = ' AND '.join([f"{lang} IS NOT NULL AND {lang} != ''" for lang in languages])
            cursor.execute(f"""
                SELECT COUNT(*) as complete FROM questions
                WHERE {conditions}
            """)
            complete = cursor.fetchone()['complete']
        else:
            complete = 0
        
        conn.close()
        
        return jsonify({
            'total_questions': total,
            'total_groups': total_groups,
            'complete_responses': complete,
            'available_languages': languages,
            'by_group': by_group
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Use PORT environment variable or default to 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
