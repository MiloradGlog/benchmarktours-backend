import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { registerUser, loginUser, CreateUserData, LoginData } from './auth.service';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const userData: CreateUserData = req.body;
    const user = await registerUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message === 'User with this email already exists') {
      res.status(409).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const loginData: LoginData = req.body;
    const authResult = await loginUser(loginData);

    res.status(200).json({
      message: 'Login successful',
      token: authResult.token,
      user: authResult.user
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.message === 'Invalid credentials') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};