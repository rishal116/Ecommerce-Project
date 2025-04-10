const express = require('express')
const app = express()
const path = require("path")
const env = require('dotenv').config()
const session = require("express-session")
const passport = require("passport")
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")
const db = require("./config/db")
require("./config/passport");
const nocache = require('nocache')
const flash = require("express-flash")
db()


app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(nocache())
app.use(flash())

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine','ejs')
app.set('views', [path.join(__dirname, 'views/user'),path.join(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname,"public")))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use("/productDetails", express.static("public"));
app.use("/contact", express.static("public"));



app.use('/',userRouter)
app.use('/admin',adminRouter)


app.listen(process.env.PORT,()=> {
    console.log("SERVER RUNNING");
    
})

module.exports = app
