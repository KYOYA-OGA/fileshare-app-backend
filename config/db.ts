import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useFindAndModify: true,
      useUnifiedTopology: true,
    })
  } catch (err) {
    console.log('Connection error', err.message)
  }

  const connection = mongoose.connection
  if (connection.readyState >= 1) {
    console.log('Connected to DB')
    return
  }
  connection.on('error', () => console.log('connection failed'))
}

export default connectDB
