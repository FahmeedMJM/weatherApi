require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors()); //Setup CORS

const dbUrl = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASS}@cluster0.jhpvqx2.mongodb.net/?retryWrites=true&w=majority`;

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const userSchema = new mongoose.Schema({
  email: String,
  location: String,
});

const User = mongoose.model('User', userSchema);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  user: 'smtp.gmail.com',
  secure: true,
  port: 465,
  auth: {
    type: 'login',
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

app.use(express.json()); //using body as raw json

// Route to store user details
app.post('/storeUserDetails', async (req, res) => {
  try {
    // console.log(req.body);
    const { email, location } = req.body;
    const user = new User({ email, location });
    const resp = await user.save();
    // console.log('User details stored successfully', resp);
    res.send('User details stored successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/users/:userId/weather', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    // console.log('found user weather', user);

    if (!user) {
      return res.status(404).send('User not found');
    }
    // console.log(user);
    const report = generateWeatherReport(user.location, user.email); // Generate report based on user's location
    await sendWeatherReport(user.email, report);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to update user's location
app.put('/updateUserLocation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { newLocation } = req.body;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).send('User not found');
    }

    user.location = newLocation;
    const resp = await user.save();
    res.send('User location updated successfully', resp);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

const sendWeatherReport = async (toEmail, report) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: toEmail,
      subject: 'Hourly Weather Report',
      text: report,
    };

    await transporter.sendMail(mailOptions);
    console.log('Weather report sent successfully');
  } catch (error) {
    console.error(error);
  }
};

// Schedule the task to send reports every 3 hours
cron.schedule('0 */3 * * *', async () => {
  try {
    const users = await User.find(); // Get all users

    for (const user of users) {
      const report = generateWeatherReport(user.location); // Generate report based on user's location
    }
  } catch (error) {
    console.error(error);
  }
});

function generateWeatherReport(location, email) {
  const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.API_KEY}`;
  axios
    .get(apiUrl)
    .then((response) => {
      // Handle the response data here
      console.log('weather', response.data);
      const weatherData = response.data;
      const report =
        `Weather report for ${location}:` + JSON.stringify(weatherData); // Replace with actual weather data
      //   console.log(weatherData);
      sendWeatherReport(email, report);
    })
    .catch((error) => {
      // Handle errors here
      console.error('Error fetching weather data:', error);
      return 'Error fetching weather data:' + error;
    });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
module.exports = app

