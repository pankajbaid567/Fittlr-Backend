const { StatusCodes } = require('http-status-codes');
const prisma = require('../../db/connect');
const {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} = require('../../errors/index');

// Send a new challenge
const sendChallenge = async (req, res) => {
  // Get receiverId from query parameters
  const {receiverId} = req.params;
  // Get other data from body
  const { type, description, count, duration } = req.body;
  const senderId = req.user.googleId; // Changed from userId to googleId

  if (!receiverId || !type || !description) {
    throw new BadRequestError('Receiver, type, and description are required');
  }

  // Validate challenge type and required parameters
  if (type === 'COUNT_BASED' && !count) {
    throw new BadRequestError('Count is required for COUNT_BASED challenges');
  }

  if (type === 'TIME_BASED' && !duration) {
    throw new BadRequestError('Duration is required for TIME_BASED challenges');
  }

  try {
    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { googleId: receiverId } // Changed from userId to googleId
    });
    
    if (!receiver) {
      throw new NotFoundError('Receiver not found');
    }

    const challenge = await prisma.challenge.create({
      data: {
        sender: { connect: { googleId: senderId } },
        receiver: { connect: { googleId: receiverId } },
        type,
        description,
        count: type === 'COUNT_BASED' ? count : null,
        duration: type === 'TIME_BASED' ? duration : null,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        },
        receiver: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        }
      }
    });
    
    res.status(StatusCodes.CREATED).json({ challenge });
  } catch (error) {
    console.error('Error sending challenge:', error);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Failed to send challenge');
  }
};

// Get challenges received by the user
const getReceivedChallenges = async (req, res) => {
  const userId = req.user.googleId;
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  
  try {
    const where = { receiverId: userId };
    if (status) {
      where.status = status;
    }

    const [challenges, totalChallenges] = await Promise.all([
      prisma.challenge.findMany({
        where,
        include: {
          sender: {
            select: {
              googleId: true,
              name: true,
              profileImg: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.challenge.count({ where })
    ]);
    
    const totalPages = Math.ceil(totalChallenges / limit);
    
    res.status(StatusCodes.OK).json({
      challenges,
      currentPage: parseInt(page),
      totalPages,
      totalChallenges
    });
  } catch (error) {
    console.error('Error getting received challenges:', error);
    throw new Error('Failed to fetch received challenges');
  }
};

// Get challenges sent by the user
const getSentChallenges = async (req, res) => {
  const userId = req.user.googleId;
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  
  try {
    const where = { senderId: userId };
    if (status) {
      where.status = status;
    }

    const [challenges, totalChallenges] = await Promise.all([
      prisma.challenge.findMany({
        where,
        include: {
          receiver: {
            select: {
              googleId: true,
              name: true,
              profileImg: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.challenge.count({ where })
    ]);
    
    const totalPages = Math.ceil(totalChallenges / limit);
    
    res.status(StatusCodes.OK).json({
      challenges,
      currentPage: parseInt(page),
      totalPages,
      totalChallenges
    });
  } catch (error) {
    console.error('Error getting sent challenges:', error);
    throw new Error('Failed to fetch sent challenges');
  }
};

// Get a single challenge by ID
const getChallenge = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.googleId;
  
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        },
        receiver: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        }
      }
    });

    if (!challenge) {
      throw new NotFoundError('Challenge not found');
    }

    // Verify user is either sender or receiver
    if (challenge.senderId !== userId && challenge.receiverId !== userId) {
      throw new UnauthenticatedError('You are not authorized to view this challenge');
    }

    res.status(StatusCodes.OK).json({ challenge });
  } catch (error) {
    console.error('Error getting challenge:', error);
    if (error instanceof NotFoundError || error instanceof UnauthenticatedError) {
      throw error;
    }
    throw new Error('Failed to fetch challenge');
  }
};

// Update challenge status (accept, reject, complete)
const updateChallengeStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.googleId;

  if (!status) {
    throw new BadRequestError('Status is required');
  }

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id }
    });
    
    if (!challenge) {
      throw new NotFoundError('Challenge not found');
    }
    
    // Only receiver can update status, except COMPLETED which can be updated by sender too
    if (challenge.receiverId !== userId && 
        !(status === 'COMPLETED' && challenge.senderId === userId)) {
      throw new UnauthenticatedError('You are not authorized to update this challenge');
    }

    const updatedChallenge = await prisma.challenge.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date()
      },
      include: {
        sender: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        },
        receiver: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          }
        }
      }
    });

    res.status(StatusCodes.OK).json({ challenge: updatedChallenge });
  } catch (error) {
    console.error('Error updating challenge status:', error);
    if (error instanceof NotFoundError || error instanceof UnauthenticatedError || error instanceof BadRequestError) {
      throw error;
    }
    throw new Error('Failed to update challenge status');
  }
};

// Delete a challenge
const deleteChallenge = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.googleId;

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id }
    });
    
    if (!challenge) {
      throw new NotFoundError('Challenge not found');
    }
    
    // Only sender can delete a challenge
    if (challenge.senderId !== userId) {
      throw new UnauthenticatedError('You are not authorized to delete this challenge');
    }

    // Can only delete if status is PENDING
    if (challenge.status !== 'PENDING') {
      throw new BadRequestError('Only pending challenges can be deleted');
    }

    await prisma.challenge.delete({
      where: { id }
    });

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    console.error('Error deleting challenge:', error);
    if (error instanceof NotFoundError || error instanceof UnauthenticatedError || error instanceof BadRequestError) {
      throw error;
    }
    throw new Error('Failed to delete challenge');
  }
};

// Get list of users the current user follows (for challenge sending)
const getFollowing = async (req, res) => {
  const userId = req.user.googleId;
  
  try {
    const followingRelations = await prisma.follow.findMany({
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
    
    const following = followingRelations.map(relation => relation.following);
    
    res.status(StatusCodes.OK).json({ following });
  } catch (error) {
    console.error('Error getting following list:', error);
    throw new Error('Failed to fetch following list');
  }
};

module.exports = {
  sendChallenge,
  getReceivedChallenges,
  getSentChallenges,
  getChallenge,
  updateChallengeStatus,
  deleteChallenge,
  getFollowing
};