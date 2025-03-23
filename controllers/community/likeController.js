const { StatusCodes } = require("http-status-codes");
const {
  CustomAPIError,
  NotFoundError,
  BadRequestError,
} = require("../../errors/index");
const prisma = require("../../db/connect");

// Toggle like status (like or unlike)
const toggleLike = async (req, res) => {
  const { postId } = req.params;

  // Case-insensitive property extraction
  const userIdentifier =
    req.body.userId ||
    req.body.UserId ||
    req.body.googleId ||
    req.body.GoogleId;

  if (!userIdentifier) {
    throw new BadRequestError("User ID is required");
  }

  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Check if already liked - using findFirst instead of findUnique
    const existingLike = await prisma.like.findFirst({
      where: {
        postId: postId,
        userId: userIdentifier, // Use userIdentifier instead of googleId
      },
    });

    // If already liked, unlike it
    if (existingLike) {
      await prisma.like.deleteMany({
        where: {
          postId: postId,
          userId: userIdentifier, // Use userIdentifier instead of googleId
        },
      });

      return res.status(StatusCodes.OK).json({
        liked: false,
        message: "Post unliked successfully",
      });
    }

    // If not liked, create a like
    const like = await prisma.like.create({
      data: {
        post: { connect: { id: postId } },
        user: { connect: { googleId: userIdentifier } }, // This is correct - connects to User's googleId
      },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          },
        },
      },
    });

    res.status(StatusCodes.CREATED).json({
      liked: true,
      like,
      message: "Post liked successfully",
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    throw error;
  }
};

// Get likes for a post
const getLikes = async (req, res) => {
  const { postId } = req.params;

  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Get likes
    const likes = await prisma.like.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          },
        },
      },
    });

    res.status(StatusCodes.OK).json({
      likes,
      count: likes.length,
    });
  } catch (error) {
    console.error("Error getting likes:", error);
    throw error;
  }
};

// Check if user has liked a post
const checkLikeStatus = async (req, res) => {
  const { postId } = req.params;
  const { googleId, userId } = req.body; // Extract both possible fields

  // Use userId if provided, otherwise use googleId
  const userIdentifier = userId || googleId;

  if (!userIdentifier) {
    throw new BadRequestError("User ID is required");
  }

  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Check if already liked - using findFirst instead of findUnique
    const existingLike = await prisma.like.findFirst({
      where: {
        postId: postId,
        userId: userIdentifier, // This field name matches the schema
      },
    });

    res.status(StatusCodes.OK).json({
      liked: !!existingLike,
    });
  } catch (error) {
    console.error("Error checking like status:", error);
    throw error;
  }
};

module.exports = {
  toggleLike,
  getLikes,
  checkLikeStatus,
};
