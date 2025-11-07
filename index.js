const express = require('express')
const app = express()
const cors = require('cors')
const { Pool } = require('pg')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL
  )
`).then(() => console.log('Users table ready'))
  .catch(err => console.error('Error creating users table:', err))

pool.query(`
  CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    description VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE
  )
`).then(() => console.log('Exercises table ready'))
  .catch(err => console.error('Error creating exercises table:', err))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/api/users', async (req, res) => {
  const { username } = req.body
  
  try {
    const result = await pool.query(
      'INSERT INTO users (username) VALUES ($1) RETURNING id, username',
      [username]
    )
    res.json({
      username: result.rows[0].username,
      _id: result.rows[0].id
    })
  } catch (err) {
    console.error('Error creating user:', err)
    res.status(500).json({ error: 'Error creating user' })
  }
})

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id as _id, username FROM users')
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Error fetching users' })
  }
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params
  const { description, duration, date } = req.body
  
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [_id])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const exerciseDate = date ? new Date(date) : new Date()
    
    const result = await pool.query(
      'INSERT INTO exercises (user_id, description, duration, date) VALUES ($1, $2, $3, $4) RETURNING *',
      [_id, description, parseInt(duration), exerciseDate]
    )
    
    res.json({
      username: userResult.rows[0].username,
      description: result.rows[0].description,
      duration: result.rows[0].duration,
      date: new Date(result.rows[0].date).toDateString(),
      _id: parseInt(_id)
    })
  } catch (err) {
    console.error('Error adding exercise:', err)
    res.status(500).json({ error: 'Error adding exercise' })
  }
})

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params
  const { from, to, limit } = req.query
  
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [_id])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    let query = 'SELECT description, duration, date FROM exercises WHERE user_id = $1'
    const params = [_id]
    let paramCount = 1
    
    if (from) {
      paramCount++
      query += ` AND date >= $${paramCount}`
      params.push(from)
    }
    
    if (to) {
      paramCount++
      query += ` AND date <= $${paramCount}`
      params.push(to)
    }
    
    query += ' ORDER BY date'
    
    if (limit) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      params.push(parseInt(limit))
    }
    
    const result = await pool.query(query, params)
    
    const log = result.rows.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: new Date(exercise.date).toDateString()
    }))
    
    res.json({
      username: userResult.rows[0].username,
      count: result.rows.length,
      _id: parseInt(_id),
      log
    })
  } catch (err) {
    console.error('Error fetching logs:', err)
    res.status(500).json({ error: 'Error fetching logs' })
  }
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})