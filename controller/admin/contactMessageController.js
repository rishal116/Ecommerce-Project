const User = require("../../models/userSchema")
const Contact = require("../../models/contactSchema")

const getContactMessages = async (req, res) => {
    try {
        const user = req.session.admin; 
        const messages = await Contact.find().sort({ createdAt: -1 }); 

        res.render("contactMessages", { user, messages });
    } catch (error) {
        console.error("Error fetching contact messages:", error);
        res.redirect("/admin/dashboard");
    }
};

const deleteContactMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedMessage = await Contact.findByIdAndDelete(id);

        if (!deletedMessage) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        res.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const searchMessages = async (req, res) => {
    try {
        const searchTerm = req.query.q || "";
        const regex = new RegExp(searchTerm, "i"); 
        const messages = await Contact.find({
            $or: [
                { name: regex },
                { email: regex },
                { phone: regex },
                { subject: regex },
                { message: regex }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, messages });
    } catch (error) {
        console.error("Error searching messages:", error);
        res.json({ success: false });
    }
};

module.exports = { 
    getContactMessages,
    deleteContactMessage,
    searchMessages 
};
