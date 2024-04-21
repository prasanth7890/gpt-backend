import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const {Schema} = mongoose;

mongoose.connect(process.env.MONGO_URI as string).then(()=>console.log('connected to DB')).catch((error)=>console.log(error));

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    chats: {
        type: [{ type: Schema.Types.ObjectId, ref: 'ChatHistory' }],
    }
});

const chatHistorySchema = new Schema({
    email: {
        type: String,
        required: true
    },
    history: {
        type: [Object],
        default: []
    }
})

export const User = mongoose.model('User', UserSchema);
export const chatHistory = mongoose.model('ChatHistory', chatHistorySchema);