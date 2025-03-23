# Follow API Documentation

## Base URL

```
http://localhost:5000/api/v1/follow
```

(Adjust the base URL according to your server configuration)

## Authentication

All follow endpoints require authentication. Include the JWT token in the request headers:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### 1. Follow a User

**Endpoint:** `POST /follow/:userIdToFollow`

**URL Params:**

- `userIdToFollow` - The Google ID of the user you want to follow

**Example Request:**

```
POST http://localhost:5000/api/v1/follow/follow/1234567890
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User followed successfully",
  "followedUser": {
    "googleId": "1234567890",
    "name": "John Doe",
    "profileImg": "https://example.com/profile.jpg"
  }
}
```

**Possible Errors:**

- 400 Bad Request: "You cannot follow yourself"
- 400 Bad Request: "You are already following this user"
- 404 Not Found: "User not found"

### 2. Unfollow a User

**Endpoint:** `DELETE /unfollow/:userIdToUnfollow`

**URL Params:**

- `userIdToUnfollow` - The Google ID of the user you want to unfollow

**Example Request:**

```
DELETE http://localhost:5000/api/v1/follow/unfollow/1234567890
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "User unfollowed successfully"
}
```

**Possible Errors:**

- 400 Bad Request: "You are not following this user"

### 3. Get Followers

**Endpoint:** `GET /followers`

**Example Request:**

```
GET http://localhost:5000/api/v1/follow/followers
```

**Response (200 OK):**

```json
{
  "success": true,
  "count": 2,
  "followers": [
    {
      "googleId": "1234567890",
      "name": "John Doe",
      "profileImg": "https://example.com/john.jpg",
      "email": "john@example.com"
    },
    {
      "googleId": "0987654321",
      "name": "Jane Smith",
      "profileImg": "https://example.com/jane.jpg",
      "email": "jane@example.com"
    }
  ]
}
```

### 4. Get Following

**Endpoint:** `GET /following`

**Example Request:**

```
GET http://localhost:5000/api/v1/follow/following
```

**Response (200 OK):**

```json
{
  "success": true,
  "count": 2,
  "following": [
    {
      "googleId": "2345678901",
      "name": "Alice Johnson",
      "profileImg": "https://example.com/alice.jpg",
      "email": "alice@example.com"
    },
    {
      "googleId": "3456789012",
      "name": "Bob Williams",
      "profileImg": "https://example.com/bob.jpg",
      "email": "bob@example.com"
    }
  ]
}
```

## Testing Instructions

1. First, obtain a valid JWT token by authenticating a user.
2. Set up a collection in Postman for testing these endpoints.
3. Create environment variables for your base URL and JWT token.
4. For each request, ensure you have the Authorization header set.
5. Test each endpoint with valid and invalid inputs to verify error handling.

### Sequence for Testing

1. Follow a user → Should succeed
2. Follow the same user again → Should fail with "already following" error
3. Get following list → Should include the user you just followed
4. Unfollow the user → Should succeed
5. Get following list again → Should no longer include that user
6. Unfollow the same user again → Should fail with "not following" error
