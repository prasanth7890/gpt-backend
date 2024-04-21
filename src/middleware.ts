import dotenv from 'dotenv';
dotenv.config();

import { Response } from "express";
import * as jose from 'jose';

export async function authMiddleware(req: any, res: Response, next:any) {
    try {
        const token = req.cookies['gpt-token'];
        if(!token) {
            return res.status(404).json({msg: 'User not Authorised'});
        }

        const {payload} = await jose.jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET as string));
        req.email = payload.email;
        next();

    } catch (error: any) {
        return res.json({msg: error.message});
    }
}

