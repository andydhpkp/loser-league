var nodemailer = require('nodemailer')
require('dotenv').config();

function forgotEmail() {

    var userEmail = document.getElementById('forgotPasswordEmail')

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'andrewdurham1094@gmail.com',
          pass: process.env.EMAIL_PW
        }
      });
      
      var mailOptions = {
        from: 'andrewdurham1094@gmail.com',
        to: userEmail,
        subject: 'Forgot Loser League Password',
        text: `I will figure this out eventually`
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}