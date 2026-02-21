# GrievMitra Backend API

Backend API for the Grievance Management System built with Node.js, Express, and MongoDB Atlas.

## Features

- User authentication (Register/Login)
- Grievance submission and tracking
- Admin dashboard for grievance management
- JWT-based authentication
- MongoDB Atlas cloud database
- CORS enabled for frontend integration

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `PUT /auth/profile` - Update user profile

### Grievances
- `POST /grievances/create` - Submit new grievance
- `GET /grievances/:refId` - Track grievance by reference ID
- `GET /grievances/user` - Get user's grievances
- `GET /admin/grievances` - Admin view all grievances

## Local Development

1. Install dependencies:
```
bash
npm install
```

2. Create `.env` file with your environment variables:
```
env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

3. Start the server:
```
bash
npm start
# or for development
npm run dev
```

## Deployment Options

### 1. Railway (Recommended - Easiest)

1. **Sign up/Login to Railway:**
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Deploy:**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js and deploy

3. **Environment Variables:**
   - Go to your project → Variables
   - Add these variables:
     - `MONGODB_URI` = `your_mongodb_atlas_connection_string`
     - `JWT_SECRET` = `your_secure_jwt_secret_here`
     - `NODE_ENV` = `production`

4. **Get URL:**
   - Railway will provide a URL like: `https://grievmitra-backend.up.railway.app`

### 2. Heroku

1. **Install Heroku CLI:**
```
bash
npm install -g heroku
heroku login
```

2. **Create Heroku app:**
```
bash
heroku create grievmitra-backend
```

3. **Set environment variables:**
```
bash
heroku config:set MONGODB_URI="your_mongodb_atlas_connection_string"
heroku config:set JWT_SECRET="your_secure_jwt_secret_here"
heroku config:set NODE_ENV="production"
```

4. **Deploy:**
```
bash
git push heroku main
```

### 3. Vercel

1. **Install Vercel CLI:**
```
bash
npm install -g vercel
```

2. **Deploy:**
```
bash
vercel
```

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add environment variables

### 4. DigitalOcean App Platform

1. **Create app on DigitalOcean:**
   - Go to DigitalOcean → Apps → Create App
   - Connect your repository

2. **Configure:**
   - Runtime: Node.js
   - Build Command: `npm install`
   - Run Command: `npm start`

3. **Environment Variables:**
   - Add the same variables as above

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port (optional) | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `your_secret_key` |
| `NODE_ENV` | Environment mode | `production` |

## Security Notes

- Change the `JWT_SECRET` to a strong, random string in production
- Never commit `.env` files to version control
- Use HTTPS in production
- Consider implementing rate limiting for API endpoints

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB Atlas** - Cloud database
- **Mongoose** - MongoDB ODM
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication
- **cors** - Cross-origin resource sharing

## License

MIT License
