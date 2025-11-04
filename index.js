const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
})

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)
const Exercise = mongoose.model('Exercise', exerciseSchema)

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/api/users', async (req, res) => {
  const { username } = req.body
  
  try {
    const newUser = new User({ username })
    const savedUser = await newUser.save()
    res.json({
      username: savedUser.username,
      _id: savedUser._id
    })
  } catch (err) {
    res.status(500).json({ error: 'Error creating user' })
  }
})

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('_id username')
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' })
  }
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params
  const { description, duration, date } = req.body
  
  try {
    const user = await User.findById(_id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const exerciseDate = date ? new Date(date) : new Date()
    
    const newExercise = new Exercise({
      userId: _id,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    })
    
    const savedExercise = await newExercise.save()
    
    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
      _id: user._id
    })
  } catch (err) {
    res.status(500).json({ error: 'Error adding exercise' })
  }
})

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params
  const { from, to, limit } = req.query
  
  try {
    const user = await User.findById(_id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    let filter = { userId: _id }
    
    if (from || to) {
      filter.date = {}
      if (from) {
        filter.date.$gte = new Date(from)
      }
      if (to) {
        filter.date.$lte = new Date(to)
      }
    }
    
    let query = Exercise.find(filter).select('description duration date')
    
    if (limit) {
      query = query.limit(parseInt(limit))
    }
    
    const exercises = await query.exec()
    
    const log = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }))
    
    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log
    })
  } catch (err) {
    res.status(500).json({ error: 'Error fetching logs' })
  }
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})