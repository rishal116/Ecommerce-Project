const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const pageError = async(req,res)=> {
    try{
        res.render("adminError",{message:"We can't find the page you're looking for."})
    }
    catch(error){
        console.log("Error in pageError",error)
        res.redirect("/admin/pageError")
    }
}

const loadLogin = async(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin")
    }
    res.render("adminLogin",{message:null})
}

const login = async(req,res)=>{
    try {
        const {email,password} = req.body
        const admin = await User.findOne({email,isAdmin:true})
        const adminPass = admin.password

        if(admin){
            if(adminPass == password){
                req.session.admin = true
                return res.redirect("/admin")
            }else{
                return res.redirect("/admin/login")
            }
        }else{
            return res.redirect("/admin/login")
        }
    } catch (error) {
        console.error("Error in login: ",error)
        return res.redirect("/admin/pageError")
    }
}

const loadDashboard = async(req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            console.log("Error in loadDasboard: ",error)
            res.redirect("/admin/pageError")
        }
    }
}

const logout = async(req,res)=>{
    try {
        req.session.admin = undefined
        return res.redirect("/admin/login")

    } catch (error) {
        console.log("Error in logout: ",error)
        res.redirect("/admin/pageError")
        
    }
}

module.exports = {
    pageError,
    loadLogin,
    login,
    loadDashboard,
    logout
}