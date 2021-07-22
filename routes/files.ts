import express from 'express'
import multer from 'multer'
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary'
import File from '../models/File'

import https from 'https'
import nodemailer from 'nodemailer'
import createEmailTemplate from '../utils/createEmailTemplate'

const router = express.Router()

const storage = multer.diskStorage({})

let upload = multer({ storage })

router.post('/upload', upload.single('myFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File not found' })

    let uploadedFile: UploadApiResponse
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: 'shareMe',
        resourse_type: 'auto',
      })
    } catch (error) {
      console.log(error.message)
      return res.status(400).json({ message: 'Cloudinary error' })
    }

    const { originalname } = req.file
    const { secure_url, bytes, format } = uploadedFile

    const file = await File.create({
      filename: originalname,
      sizeInBytes: bytes,
      secure_url,
      format,
    })
    res.status(200).json({
      id: file._id,
      downloadPageLink: `${process.env.API_BASE_ENDPOINT_CLIENT}/download/${file._id}`,
    })
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ message: 'Internal Server Error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const file = await File.findById(id)

    if (!file) return res.status(404).json({ message: 'File not found' })

    const { filename, format, sizeInBytes } = file
    return res.status(200).json({
      name: filename,
      sizeInBytes,
      format,
      id,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

router.get('/:id/download', async (req, res) => {
  try {
    const id = req.params.id
    const file = await File.findById(id)

    if (!file) return res.status(404).json({ message: 'File not found' })

    https.get(file.secure_url, (fileStream) => fileStream.pipe(res))
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

router.post('/email', async (req, res) => {
  // 1. validate request

  const { id, emailFrom, emailTo } = req.body

  // 2. check if the file exists
  const file = await File.findById(id)
  if (!file) return res.status(404).json({ message: 'File not found' })

  // 3. create transporter
  let transporter = nodemailer.createTransport({
    // @ts-ignore
    host: process.env.SENDINBLUE_SMTP_HOST!,
    port: process.env.SENDINBLUE_SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SENDINBLUE_SMTP_USER,
      pass: process.env.SENDINBLUE_SMTP_PASSWORD,
    },
  })

  // 4. prepare the email data
  const { filename, sizeInBytes } = file

  const fileSize = `${(Number(sizeInBytes) / (1024 * 1024)).toFixed(2)} MB`
  const downloadPageLink = `${process.env.API_BASE_ENDPOINT_CLIENT}/download/${id}`

  const mailOptions = {
    from: emailFrom,
    to: emailTo,
    subject: 'あなたに共有されたファイルです', // Subject line
    text: `${emailFrom} があなたにファイルを共有しました`, // plain text body
    html: createEmailTemplate(emailFrom, downloadPageLink, filename, fileSize), // html body
  }

  // 5. send the email using the transporter
  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
    file.sender = emailFrom
    file.receiver = emailTo

    // 6. save the data and send the response
    await file.save()
    res.status(200).json({ message: 'メールが送信されました' })
  })
})

export default router
