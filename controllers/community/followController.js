const { StatusCodes } = require('http-status-codes');
const prisma = require('../../db/connect');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../../errors/index');

// Follow a user
const followUser = async (req, res) => {
  const { userIdToFollow } = req.params;
  const currentUserId = req.user.googleId;

  // Can't follow yourself
  if (userIdToFollow === currentUserId) {
    throw new BadRequestError("You cannot follow yourself");
  }

  try {
    // Check if user to follow exists
    const userToFollow = await prisma.user.findUnique({
      where: { googleId: userIdToFollow }
    });

    if (!userToFollow) {
      throw new NotFoundError('User not found');
    }

    // Check if already following
    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userIdToFollow
      }
    });

    if (existingFollow) {
      throw new BadRequestError('You are already following this user');
    }

    // Create follow relationship
    const follow = await prisma.follow.create({
      data: {
        follower: { connect: { googleId: currentUserId } },
        following: { connect: { googleId: userIdToFollow } }
      },
      include: {
        following: {
          select: {
            googleId: true,
            name: true,
            profileImg: true
          }
        }
      }
    });

    res.status(StatusCodes.CREATED).json({ 
      success: true,
      message: 'User followed successfully',
      followedUser: follow.following
    });
  } catch (error) {
    console.error('Error following user:', error);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Failed to follow user');
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  const { userIdToUnfollow } = req.params;
  const currentUserId = req.user.googleId;

  try {
    // Check if the follow relationship exists
    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userIdToUnfollow
      }
    });

    if (!existingFollow) {
      throw new BadRequestError('You are not following this user');
    }

    // Delete the follow relationship
    await prisma.follow.delete({
      where: {
        id: existingFollow.id
      }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User unfollowed successfully'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new Error('Failed to unfollow user');
  }
};

// Get users following the current user
const getFollowers = async (req, res) => {
  const userId = req.user.googleId;

  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
            email: true
          }
        }
      }
    });

    const formattedFollowers = followers.map(follow => follow.follower);

    res.status(StatusCodes.OK).json({
      success: true, 
      count: formattedFollowers.length,
      followers: formattedFollowers
    });
  } catch (error) {
    console.error('Error getting followers:', error);
    throw new Error('Failed to fetch followers');
  }
};

// Get users the current user is following
const getFollowing = async (req, res) => {
  const userId = req.user.googleId;

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
            email: true
          }
        }
      }
    });

    const formattedFollowing = following.map(follow => follow.following);

    res.status(StatusCodes.OK).json({
      success: true,
      count: formattedFollowing.length,
      following: formattedFollowing
    });
  } catch (error) {
    console.error('Error getting following list:', error);
    throw new Error('Failed to fetch following list');
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
};