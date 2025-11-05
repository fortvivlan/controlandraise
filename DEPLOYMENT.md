# Quick Start Guide for Render.com Deployment

This guide will help you deploy your Grant Database to Render.com in minutes.

## Prerequisites

- A [Render.com](https://render.com) account (free tier available)
- Git installed on your computer
- Your database files ready

## Step-by-Step Deployment

### 1. Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in the details:
   - **Name:** `grant-database`
   - **Database:** `grant_db`
   - **Region:** Choose closest to you
   - **PostgreSQL Version:** 15
   - **Plan:** Free (or paid for better performance)
4. Click **"Create Database"**
5. Wait for database to be provisioned (1-2 minutes)

### 2. Import Your Data

#### Get the connection string:
1. In your database dashboard, find **"Connections"**
2. Copy the **"External Database URL"** (looks like: `postgresql://user:password@host/database`)

#### Import via psql (recommended):
```bash
# Install psql if you don't have it
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: Download from postgresql.org

# Import the schema
psql "your-external-database-url-here" < schema_postgres.sql
```

#### Alternative: Using a GUI tool:
- Download [pgAdmin](https://www.pgadmin.org/) or [DBeaver](https://dbeaver.io/)
- Connect using the External Database URL
- Open `schema_postgres.sql` and execute it

### 3. Deploy the API (Optional)

If you want to create a web API for your database:

#### Option A: Deploy as Web Service on Render

1. Push your code to GitHub (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/grant-database.git
   git push -u origin main
   ```

2. On Render Dashboard, click **"New +"** → **"Web Service"**

3. Connect your GitHub repository

4. Configure the service:
   - **Name:** `grant-database-api`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Plan:** Free (or paid)

5. Add Environment Variable:
   - Key: `DATABASE_URL`
   - Value: Your Internal Database URL (from Step 1)

6. Click **"Create Web Service"**

7. Your API will be available at: `https://grant-database-api.onrender.com`

#### Option B: Run Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your DATABASE_URL

# Run the app
python app.py
```

### 4. Test Your Deployment

#### Test the database directly:
```bash
psql "your-external-database-url-here"

# Run test queries
SELECT COUNT(*) FROM questions;
SELECT * FROM questions WHERE group_number = '1' LIMIT 5;
```

#### Test the API (if deployed):
```bash
# Get all groups
curl https://your-api-url.onrender.com/api/groups

# Get questions from group 1
curl https://your-api-url.onrender.com/api/questions/group/1

# Get random question from group 2
curl https://your-api-url.onrender.com/api/questions/random/2

# Search
curl "https://your-api-url.onrender.com/api/search?q=контроль"
```

## API Endpoints

Your deployed API will have these endpoints:

- `GET /` - API documentation
- `GET /api/groups` - List all groups with counts
- `GET /api/questions/group/<group_number>` - Get all questions in a group
- `GET /api/questions/random/<group_number>` - Get random question(s) from a group
  - Optional: `?count=5` to get multiple random questions
- `GET /api/questions/<question_number>` - Get specific question
- `GET /api/search?q=<query>` - Search across all fields
  - Optional: `&lang=russian` to search specific language
- `GET /api/stats` - Get database statistics

## Connecting from Your Website

### JavaScript/Fetch Example:
```javascript
// Get all groups
fetch('https://your-api-url.onrender.com/api/groups')
  .then(response => response.json())
  .then(data => console.log(data));

// Get random question from group 1
fetch('https://your-api-url.onrender.com/api/questions/random/1')
  .then(response => response.json())
  .then(question => {
    console.log(question.question_text);
    console.log(question.russian);
  });

// Search
fetch('https://your-api-url.onrender.com/api/search?q=контроль&lang=russian')
  .then(response => response.json())
  .then(data => console.log(data.results));
```

### Python/Requests Example:
```python
import requests

base_url = 'https://your-api-url.onrender.com'

# Get all groups
groups = requests.get(f'{base_url}/api/groups').json()

# Get questions from group 1
questions = requests.get(f'{base_url}/api/questions/group/1').json()

# Get random question
random_q = requests.get(f'{base_url}/api/questions/random/2').json()

# Search
results = requests.get(f'{base_url}/api/search', params={'q': 'контроль'}).json()
```

## Troubleshooting

### Database connection fails
- Check that DATABASE_URL is correct
- Verify your IP isn't blocked (Render allows all by default)
- Ensure database is fully provisioned

### API deployment fails
- Check build logs in Render dashboard
- Verify requirements.txt is present
- Ensure gunicorn is in requirements.txt

### Slow queries
- Add indexes to frequently queried columns
- Upgrade to a paid plan for better performance
- Use connection pooling

## Cost Estimates

### Free Tier Limits:
- **PostgreSQL:** 1GB storage, shared CPU
- **Web Service:** 750 hours/month, spins down after inactivity
- Perfect for development and small projects

### Upgrade When:
- Database > 1GB
- Need faster response times
- Need 24/7 availability (no spin down)
- Multiple concurrent users

## Next Steps

1. **Add authentication** to protect your API
2. **Implement caching** for better performance
3. **Add rate limiting** to prevent abuse
4. **Set up monitoring** to track usage
5. **Create a frontend** to interact with your data

## Support

- Render Documentation: https://render.com/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Flask Documentation: https://flask.palletsprojects.com/

## Notes

- Free tier databases spin down after inactivity
- First request after spin-down takes ~30 seconds
- Free tier has no automatic backups (manual backups available)
- Consider paid plan for production use
