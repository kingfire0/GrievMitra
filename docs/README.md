# GrievMitra Portal
<p align="center"> <img src="https://img.shields.io/badge/Status-Active-brightgreen" /> <img src="https://img.shields.io/badge/Version-1.0.0-blue" /> <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-orange" /> <img src="https://img.shields.io/badge/Backend-Firebase-yellow" /> <img src="https://img.shields.io/badge/Platform-Web-lightgrey" /> </p>

GrievMitra Portal is a comprehensive grievance management system designed to facilitate efficient handling of citizen grievances. It provides a user-friendly interface for citizens to submit grievances, track their status, and view transparency dashboards. Administrators can manage grievances, update statuses, and oversee the system. The portal supports multiple user roles (citizen, leader, admin) and ensures secure authentication and data management.

## 🚀 Features

- **User Registration and Authentication**: Secure user registration with role-based access (citizen, leader, admin). JWT-based authentication for login.
- **Grievance Submission**: Citizens can submit detailed grievances with categories, descriptions, locations, and priorities.
- **Grievance Tracking**: Users can track the status of their submitted grievances in real-time.
- **Admin Dashboard**: Administrators can view all grievances, update statuses, and manage the system.
- **Transparency Dashboard**: Public dashboard for viewing grievance statistics and resolved cases.
- **Responsive Design**: Built with Tailwind CSS for mobile-first, responsive web interfaces.
- **Backend API**: RESTful API built with Node.js, Express, and MongoDB for robust data handling.
- **Security**: Password hashing with bcrypt and secure token management.
- **Modern Frontend**: HTML5 pages with Tailwind CSS for clean, professional UI.

## 🛠️ Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Firestore](https://img.shields.io/badge/Firestore-FFA611?style=for-the-badge&logo=firebase&logoColor=white)
![Authentication](https://img.shields.io/badge/Firebase_Auth-FF6F00?style=for-the-badge&logo=firebase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![VSCode](https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)

## 📋 Prerequisites

- Node.js (v14.x or higher)
- npm or yarn
- MongoDB (local installation or cloud service like MongoDB Atlas)

## 🛠️ Installation

Follow these steps to set up the project locally:

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd grievmitra-portal
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up MongoDB**:
   - Ensure MongoDB is running locally on `mongodb://localhost:27017/grievmitra`.
   - Alternatively, update the connection string in `backend/server.js` for a cloud database.

4. **Build CSS**:
   ```bash
   npm run build:css
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   - The frontend will be served statically, and the backend API will run on port 3000.

6. **Access the Application**:
   - Open `index.html` in your browser or navigate to `http://localhost:3000` if serving via Express.

## 📁 Project Structure

```
grievmitra-portal/
├── backend/
│   ├── models/
│   │   ├── User.js          # User model with authentication methods
│   │   └── Grievance.js     # Grievance model with schema and validations
│   └── server.js            # Express server with API routes
├── css/
│   ├── tailwind.css         # Tailwind CSS source with custom utilities
│   └── main.css             # Compiled CSS output
├── pages/
│   ├── homepage.html        # Main landing page
│   ├── user_registration.html  # User registration form
│   ├── login_screen.html    # Login page
│   ├── submit_grievance.html # Grievance submission form
│   ├── track_grievance.html # Grievance tracking page
│   ├── admin_dashboard.html # Admin management interface
│   ├── transparency_dashboard.html # Public transparency view
│   └── about_griev_mitra.html # About page
├── public/
│   ├── dhws-data-injector.js # Utility scripts
│   └── manifest.json        # PWA manifest
├── index.html               # Entry point
├── package.json             # Dependencies and scripts
├── tailwind.config.js       # Tailwind configuration
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

## 🎨 Styling and Customization

- **Tailwind CSS**: The project uses Tailwind CSS for utility-first styling. Custom configurations are in `tailwind.config.js`.
- **Responsive Breakpoints**:
  - `sm`: 640px and up
  - `md`: 768px and up
  - `lg`: 1024px and up
  - `xl`: 1280px and up
  - `2xl`: 1536px and up
- **Customization**: Edit `tailwind.config.js` to add custom themes or utilities.

## 📦 Build for Production

To build optimized CSS for production:

```bash
npm run build:css
```

This compiles `css/tailwind.css` into `css/main.css`.

## 🔧 Usage

### For Citizens:
1. Register an account on the registration page.
2. Log in to access the portal.
3. Submit grievances via the "Submit Grievance" page, providing details like category, description, and location.
4. Track grievances on the "Track Grievance" page.

### For Administrators:
1. Log in with admin credentials.
2. Access the admin dashboard to view and update grievance statuses.
3. Manage users and oversee system operations.

### API Usage:
The backend provides RESTful endpoints. Use tools like Postman or curl for testing.

## 📡 API Endpoints

### Authentication
- **POST /api/register**: Register a new user.
  - Body: `{ "username": "string", "email": "string", "password": "string", "role": "citizen|leader|admin" }`
- **POST /api/login**: Authenticate user.
  - Body: `{ "email": "string", "password": "string" }`
  - Response: `{ "token": "jwt", "user": { "id": "string", "username": "string", "role": "string" } }`

### Grievances
- **POST /api/grievances**: Submit a new grievance.
  - Body: `{ "title": "string", "description": "string", "category": "string", "userId": "string" }`
- **GET /api/grievances**: Retrieve all grievances (admin view).
- **PUT /api/grievances/:id**: Update grievance status.
  - Body: `{ "status": "submitted|in_progress|resolved|rejected" }`

## 🔒 Security and Best Practices

- Passwords are hashed using bcrypt.
- JWT tokens are used for session management.
- CORS is enabled for cross-origin requests.
- Input validation is implemented in models and routes.

## 🤝 Contributing

This project is proprietary. Contributions are not accepted without explicit permission from the project owner.

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## ⚠️ Disclaimer

**Important Notice:** This project, GrievMitra Portal, is proprietary software developed for specific organizational use. Unauthorized use, reproduction, distribution, or modification of this project or its components is strictly prohibited without explicit written permission from the project owner or authorized representatives. This includes, but is not limited to, deploying the application in production environments, sharing code repositories, or using it for commercial purposes. Violation of this notice may result in legal action. If you have obtained this project through legitimate channels, ensure compliance with all applicable laws and regulations.

## 🙏 Acknowledgments

- Built with Node.js, Express, MongoDB, and Tailwind CSS.
- Inspired by efficient grievance redressal systems.

Built with ❤️ for better governance.
