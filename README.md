# Fittlr Backend

## Postman Link

https://www.postman.com/inculcate-team/workspace/fittlr/request/40649936-14432d69-3c8d-4265-b6f7-62b3c07896eb?action=share&creator=40649936&ctx=documentation

## Introduction

Fittlr is a comprehensive fitness application that provides users with a platform to manage their fitness activities, track their progress, and engage with a community of fitness enthusiasts. The backend of Fittlr is built using Node.js, Express, and Prisma, and it provides a robust API for managing user authentication, fitness data, gym bookings, and more.

## Prerequisites

Before running the app, ensure you have the following installed:

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Google Cloud account for OAuth 2.0 credentials

## Folder Structure

The project directory structure is organized as follows:

```
Fittlr-Backend/
├── controllers/
│   ├── auth/
│   │   └── User.js
│   ├── challenges/
│   │   └── challengeController.js
│   ├── community/
│   │   ├── commentController.js
│   │   ├── followController.js
│   │   ├── likeController.js
│   │   └── postController.js
│   ├── fallback/
│   │   ├── login.js
│   │   ├── logout.js
│   │   └── register.js
│   ├── Gym_Schedule/
│   │   ├── bookingFlow.controller.js
│   │   ├── bookingsummry.js
│   │   ├── createBooking.js
│   │   ├── gymSchedule.controller.js
│   │   ├── machineService.controller.js
│   │   └── machineTracking.js
│   ├── Home/
│   │   ├── googleFit.controller.js
│   │   └── googleFitfallback.js
│   ├── Profile/
│   │   └── profile.js
│   └── tickets/
│       └── tickets.js
├── db/
│   └── connect.js
├── errors/
│   ├── bad-request.js
│   ├── custom-api.js
│   ├── index.js
│   ├── not-found.js
│   └── unauthenticated.js
├── middleware/
│   ├── authentication.js
│   ├── error-handler.js
│   ├── logger.js
│   ├── not-found.js
│   └── upload.js
├── prisma/
│   ├── migrations/
│   │   ├── 20250320053553_init/
│   │   │   └── migration.sql
│   │   ├── 20250321183015_init_models/
│   │   │   └── migration.sql
│   │   ├── 20250321190437_init_models/
│   │   │   └── migration.sql
│   │   ├── 20250321192113_init_models/
│   │   │   └── migration.sql
│   │   ├── 20250322064642_init_models/
│   │   │   └── migration.sql
│   │   ├── 20250322071616_add_password_field/
│   │   │   └── migration.sql
│   │   ├── 20250322095847_add_machine_status_tickets_update/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── routes/
│   ├── booking.js
│   ├── challengeRoutes.js
│   ├── community/
│   │   ├── commentRoutes.js
│   │   ├── followRoutes.js
│   │   ├── likeRoutes.js
│   │   └── postRoutes.js
│   ├── fallback.js
│   ├── googleAuth.js
│   ├── googlefit.js
│   ├── profile.js
│   └── ticket.js
├── scripts/
│   └── setup-db.js
├── services/
│   ├── authConfig.service.js
│   ├── cache.js
│   ├── cachePreloader.js
│   ├── cloudflare.js
│   ├── googleAuth.service.js
│   ├── googleFit.service.js
│   ├── jwt_create.js
│   ├── passport.js
│   ├── passport.service.js
│   ├── password_auth.js
│   ├── token.service.js
│   └── user.service.js
├── utils/
│   ├── configValidator.js
│   ├── cookie.utils.js
│   ├── tokenRefresh.js
├── .env.example
├── .gitignore
├── app.js
├── howto.txt
├── package.json
├── user_jouney.txt
└── README.md
```

## API Documentation

### User Authentication

- **Google OAuth Login**
  - **Endpoint:** `/api/v1/user/auth/google`
  - **Method:** `GET`
  - **Description:** Initiates Google OAuth login process.

- **Google OAuth Callback**
  - **Endpoint:** `/api/v1/user/auth/google/callback`
  - **Method:** `GET`
  - **Description:** Handles Google OAuth callback and user authentication.

- **Fallback Login**
  - **Endpoint:** `/api/v1/user/auth/fallback/login`
  - **Method:** `POST`
  - **Description:** Handles fallback login with email and password.
  - **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123"
    }
    ```

- **Fallback Register**
  - **Endpoint:** `/api/v1/user/auth/fallback/register`
  - **Method:** `POST`
  - **Description:** Handles fallback user registration.
  - **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123",
      "name": "John Doe"
    }
    ```

### Profile

- **Get User Profile**
  - **Endpoint:** `/api/v1/user/profile`
  - **Method:** `GET`
  - **Description:** Retrieves the authenticated user's profile.

- **Update User Profile**
  - **Endpoint:** `/api/v1/user/profile`
  - **Method:** `PUT`
  - **Description:** Updates the authenticated user's profile.
  - **Request Body:**
    ```json
    {
      "name": "John Doe"
    }
    ```

### Gym Booking

- **Get Gym Availability**
  - **Endpoint:** `/api/v1/user/booking/availability`
  - **Method:** `GET`
  - **Description:** Retrieves gym availability for booking.
  - **Query Parameters:**
    - `gymId` (required): ID of the gym.
    - `date` (optional): Date for availability check (YYYY-MM-DD).
    - `startTime` (optional): Start time for availability check (HH:MM).
    - `duration` (optional): Duration for availability check (minutes).

- **Create Booking**
  - **Endpoint:** `/api/v1/user/booking/create`
  - **Method:** `POST`
  - **Description:** Creates a new gym booking.
  - **Request Body:**
    ```json
    {
      "userId": "user123",
      "gymId": "gym123",
      "startTime": "2023-10-01T10:00:00Z",
      "duration": 60,
      "selectedMachines": [
        {
          "id": "machine123",
          "name": "Treadmill"
        }
      ]
    }
    ```

- **Get Booking Summary**
  - **Endpoint:** `/api/v1/user/booking/booksummary`
  - **Method:** `GET`
  - **Description:** Retrieves the summary of a specific booking.
  - **Query Parameters:**
    - `bookingId` (required): ID of the booking.
    - `userId` (required): ID of the user.

### Community

- **Create Post**
  - **Endpoint:** `/api/v1/user/community/posts`
  - **Method:** `POST`
  - **Description:** Creates a new post in the community.
  - **Request Body:**
    ```json
    {
      "content": "This is a new post",
      "imageUrl": "https://example.com/image.jpg"
    }
    ```

- **Get Posts**
  - **Endpoint:** `/api/v1/user/community/posts`
  - **Method:** `GET`
  - **Description:** Retrieves all posts in the community.
  - **Query Parameters:**
    - `page` (optional): Page number for pagination.
    - `limit` (optional): Number of posts per page.

- **Create Comment**
  - **Endpoint:** `/api/v1/user/community/comments/:postId`
  - **Method:** `POST`
  - **Description:** Creates a new comment on a post.
  - **Request Body:**
    ```json
    {
      "content": "This is a comment"
    }
    ```

- **Get Comments**
  - **Endpoint:** `/api/v1/user/community/comments/:postId`
  - **Method:** `GET`
  - **Description:** Retrieves comments for a specific post.
  - **Query Parameters:**
    - `page` (optional): Page number for pagination.
    - `limit` (optional): Number of comments per page.

- **Like Post**
  - **Endpoint:** `/api/v1/user/community/likes/:postId`
  - **Method:** `POST`
  - **Description:** Likes or unlikes a post.

- **Follow User**
  - **Endpoint:** `/api/v1/user/community/follow/:userIdToFollow`
  - **Method:** `POST`
  - **Description:** Follows a user.

- **Unfollow User**
  - **Endpoint:** `/api/v1/user/community/unfollow/:userIdToUnfollow`
  - **Method:** `POST`
  - **Description:** Unfollows a user.

### Challenges

- **Send Challenge**
  - **Endpoint:** `/api/v1/user/challenges/send/:receiverId`
  - **Method:** `POST`
  - **Description:** Sends a new challenge to a user.
  - **Request Body:**
    ```json
    {
      "type": "COUNT_BASED",
      "description": "50 Push-ups",
      "count": 50
    }
    ```

- **Get Received Challenges**
  - **Endpoint:** `/api/v1/user/challenges/received`
  - **Method:** `GET`
  - **Description:** Retrieves challenges received by the authenticated user.
  - **Query Parameters:**
    - `status` (optional): Filter by challenge status (PENDING, ACCEPTED, COMPLETED, REJECTED).
    - `page` (optional): Page number for pagination.
    - `limit` (optional): Number of challenges per page.

- **Get Sent Challenges**
  - **Endpoint:** `/api/v1/user/challenges/sent`
  - **Method:** `GET`
  - **Description:** Retrieves challenges sent by the authenticated user.
  - **Query Parameters:**
    - `status` (optional): Filter by challenge status (PENDING, ACCEPTED, COMPLETED, REJECTED).
    - `page` (optional): Page number for pagination.
    - `limit` (optional): Number of challenges per page.

- **Update Challenge Status**
  - **Endpoint:** `/api/v1/user/challenges/:id/status`
  - **Method:** `PUT`
  - **Description:** Updates the status of a challenge.
  - **Request Body:**
    ```json
    {
      "status": "ACCEPTED"
    }
    ```

- **Delete Challenge**
  - **Endpoint:** `/api/v1/user/challenges/:id`
  - **Method:** `DELETE`
  - **Description:** Deletes a challenge.

### Google Fit Integration

- **Get Fitness Summary**
  - **Endpoint:** `/api/v1/user/auth/google/fit/summary`
  - **Method:** `GET`
  - **Description:** Retrieves fitness data summary for the authenticated user.
  - **Query Parameters:**
    - `days` (optional): Number of days to fetch data for (default: 7).

- **Get Step Count**
  - **Endpoint:** `/api/v1/user/auth/google/fit/steps`
  - **Method:** `GET`
  - **Description:** Retrieves step count data for the authenticated user.
  - **Query Parameters:**
    - `days` (optional): Number of days to fetch data for (default: 7).

- **Get Calories Burned**
  - **Endpoint:** `/api/v1/user/auth/google/fit/calories`
  - **Method:** `GET`
  - **Description:** Retrieves calories burned data for the authenticated user.
  - **Query Parameters:**
    - `days` (optional): Number of days to fetch data for (default: 7).

- **Get Distance Walked**
  - **Endpoint:** `/api/v1/user/auth/google/fit/distance`
  - **Method:** `GET`
  - **Description:** Retrieves distance walked data for the authenticated user.
  - **Query Parameters:**
    - `days` (optional): Number of days to fetch data for (default: 7).

## Running the App

1. Clone the repository:
   ```sh
   git clone https://github.com/srijan2607/Fittlr-Backend.git
   cd Fittlr-Backend
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Set up the environment variables:
   - Create a `.env` file in the root directory.
   - Copy the contents of `.env.example` into `.env`.
   - Update the values in `.env` with your configuration.

4. Set up the database:
   ```sh
   npm run db:setup
   ```

5. Start the server:
   ```sh
   npm start
   ```

6. The server should now be running at `http://localhost:7900`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
