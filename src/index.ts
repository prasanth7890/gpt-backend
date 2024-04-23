import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { User, chatHistory } from './db.js';
import { authMiddleware } from './middleware.js';
import cookieParser from 'cookie-parser';
import * as jose from 'jose';
import bcrypt from 'bcrypt';

const genAI = new GoogleGenerativeAI(process.env.API_KEY as string);
const app = express();

app.use(cors({
  origin: process.env.ORIGIN,
  credentials: true
}));

app.use(express.json())
app.use(cookieParser());

app.get('/', (req:any, res:any)=> {
    res.cookie('mycookie', 'hello world', { sameSite: 'none', secure: true});
    res.send('server is working...');
})

const ValidateUser = z.object({
  email: z.string().email(),
  password: z.string().min(5)
});

// adds a user to db
app.post('/signup', async (req: any, res: any)=> {
  try {
    const {success} = ValidateUser.safeParse(req.body);
    if(!success) {
      res.json({success: false,msg: 'Please Enter Correct Input'});
      return;
    }
  
    const existingUser = await User.findOne({
      email: req.body.email
    })
  
    if(existingUser) {
      return res.json({success: false, msg: 'Existing User Found, Please SingIn'});
    }

    const hash = await bcrypt.hash(req.body.password, parseInt(process.env.HASH_SALT as string));
  
    const newUser = await User.create({
      email: req.body.email,
      password: hash,
    });
  
    if(newUser) {
      return res.json({success: true, msg: 'User Created Succesfully'});
    }
    
  } catch (error: any) {
    res.json({success: false, msg: error.message})
  }
})

// signin
app.post('/signin', async(req: any, res: any)=> {
  try {
    const {success} = ValidateUser.safeParse(req.body);

    if(!success) {
      res.json({msg: 'Please Enter Correct Input'});
      return;
    }

    const existingUser = await User.findOne({
      email: req.body.email
    });

    
    if(!existingUser) {
      return res.json({success: false, msg: 'User not found, Please signup'});
    }
    
    const match = await bcrypt.compare(req.body.password, existingUser.password);
    if(!match) {
      return res.json({success: false, message: 'Incorrect Password'});
    }

    const user = {
      email: existingUser.email
    }

    const token = await new jose.SignJWT(user)
                        .setProtectedHeader({ alg: 'HS256' })
                        .setIssuedAt()
                        .setExpirationTime('1d')
                        .sign(new TextEncoder().encode(process.env.JWT_SECRET as string));

    const domain = '.onrender.com';
      res.cookie('gpt-token', token, { sameSite: 'None', secure: true, domain: domain});
      res.json({success: true, message: "User logged in succesfully"});

  } catch (error: any) {
    console.log(error.message);
  }
})

// sends a message to existing chat
app.post('/chat/:id', authMiddleware , async (req:Request, res:Response)=> {
  try {
    const {prompt} = req.body;
    const {id} = req.params;
    
    const response = await run(prompt);

    const existingChat:any = await chatHistory.findById(id);

    if(!existingChat) {
      return res.json({msg: 'No chat found'});
    }

    existingChat.history = existingChat.history.concat([{role: 'user', message: prompt},{role: 'gpt', message: response}] as any);
    await existingChat.save();

    return res.json({msg: response});
    
  } catch (error: any) {
    return res.status(200).json({
      error: error.message
    });
  }
})

// retrives the existing chat history
app.get('/chat/:id', authMiddleware ,  async (req: Request, res: Response)=>{ 
  try {
    const {id} = req.params;
    const existingChat = await chatHistory.findById(id);
    if(!existingChat) {
      return res.json({msg: 'No chat found'});
    }
  
    return res.json({history : existingChat.history});

  } catch (error: any) {
    console.log(error.message);
  }
})

// creates a new chat
app.get('/chat', authMiddleware, async(req: any, res: Response)=>{
    try {
      const newChat:any = await chatHistory.create({
        email: req.email
      });

      const user:any = await User.findOne({
        email: req.email
      });

      user?.chats.push(newChat?._id);
      user.save();

      return res.json({success: true ,chatId: newChat._id, message: 'Chat Created Succesfully'});

    } catch (error: any) {
      return res.status(500).json({success: false,msg: error.message});
    }
})

// gets all chat ids of the user
app.get('/chats', authMiddleware, async (req: any, res: Response)=> {
  try {
    const userChats = await User.findOne({
      email: req.email
    }).select('-password');

    return res.json({chats: userChats?.chats});

  } catch (error:any) {
    return res.json({msg: error.message});
  }
  
})

// its working...now its not
app.get('/logout', async(req: Request, res: Response)=>{
  try {
    res.clearCookie('gpt-token');
    res.json({success: true});
    return res.end();
  } catch (error: any) {
    return res.json({success: false, message: error.message});
  }
})

app.listen(5000, ()=>{
  console.log('server running on port 5000');
})

const generationConfig: any = {
  maxOutputTokens: 200,
  temperature: 0.9,
  topP: 0.1,
  topK: 16,
};

async function run(prompt: string) {
  // For text-only input, use the gemini-pro model
  const model = genAI.getGenerativeModel({ model: "gemini-pro"}, generationConfig);
  const result = await model.generateContentStream(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
}
