from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get database URL from environment variable
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    """Create database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def get_language_columns():
    """Get list of language columns dynamically from database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'questions' 
            AND column_name NOT IN ('id', 'question_number', 'group_number', 'question_text')
            ORDER BY column_name
        """)
        languages = [row['column_name'] for row in cursor.fetchall()]
        conn.close()
        return languages
    except:
        # Fallback to original languages if query fails
        return ['russian', 'danish', 'muira', 'nganasan']

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
    """Get all groups with question counts."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT group_number, COUNT(*) as question_count
            FROM questions
            GROUP BY group_number
            ORDER BY group_number
        """)
        groups = cursor.fetchall()
        conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/questions/group/<group_number>')
def get_group_questions(group_number):
    """Get all questions in a specific group."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM questions 
            WHERE group_number = %s 
            ORDER BY question_number
        """, (group_number,))
        questions = cursor.fetchall()
        conn.close()
        
        if not questions:
            return jsonify({'error': 'Group not found'}), 404
            
        return jsonify(questions)
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
            SELECT * FROM questions 
            WHERE group_number = %s 
            ORDER BY RANDOM() 
            LIMIT %s
        """, (group_number, count))
        questions = cursor.fetchall()
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
            SELECT * FROM questions 
            WHERE question_number = %s
        """, (question_number,))
        question = cursor.fetchone()
        conn.close()
        
        if not question:
            return jsonify({'error': 'Question not found'}), 404
            
        return jsonify(question)
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
            where_clauses = ['question_text ILIKE %s'] + [f'{lang} ILIKE %s' for lang in languages]
            search_sql = f"""
                SELECT * FROM questions 
                WHERE {' OR '.join(where_clauses)}
                ORDER BY question_number
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
                SELECT * FROM questions 
                WHERE {language} ILIKE %s
                ORDER BY question_number
                LIMIT 100
            """
            cursor.execute(search_sql, (f'%{query}%',))
        
        results = cursor.fetchall()
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
        
        # Questions by group
        cursor.execute("""
            SELECT group_number, COUNT(*) as count
            FROM questions
            GROUP BY group_number
            ORDER BY group_number
        """)
        by_group = cursor.fetchall()
        
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
