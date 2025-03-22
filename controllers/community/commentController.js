const { StatusCodes } = require('http-status-codes');
const prisma = require('../../db/connect');
const {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} = require('../../errors/index');

// Create a new comment
const createComment = async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
  const userId = req.user.googleId;
  
  // Validate required fields
  if (!postId || !content) {
    throw new BadRequestError('Post ID and content are required');
  }
  
  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        post: { connect: { id: postId } },
        user: { connect: { googleId: userId } } // Changed from id to googleId
      },
      include: {
        user: {
          select: {
            googleId: true, // Changed from id
            name: true,     // Changed from username
            profileImg: true // Changed from avatar
          }
        }
      }
    });
    
    res.status(StatusCodes.CREATED).json({ comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Failed to create comment');
  }
};

// Get comments for a post with pagination
const getComments = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Get comments
    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            googleId: true, // Changed from id
            name: true,     // Changed from username
            profileImg: true // Changed from avatar
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });
    
    // Get total count for pagination
    const totalComments = await prisma.comment.count({
      where: { postId }
    });
    
    const totalPages = Math.ceil(totalComments / limit);
    
    res.status(StatusCodes.OK).json({
      comments,
      currentPage: parseInt(page),
      totalPages,
      totalComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Failed to fetch comments');
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.googleId;
  
  try {
    // Get comment to check ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });
    
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }
    
    // Check if user is the owner of the comment
    if (comment.userId !== userId) { // Changed from req.user.userId
      throw new UnauthenticatedError('You are not authorized to delete this comment');
    }
    
    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId }
    });
    
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    console.error('Error deleting comment:', error);
    if (error instanceof NotFoundError || error instanceof UnauthenticatedError) {
      throw error;
    }
    throw new Error('Failed to delete comment');
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment
};