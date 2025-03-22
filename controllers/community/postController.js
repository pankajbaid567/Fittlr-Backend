const { StatusCodes } = require('http-status-codes');
const { NotFoundError, BadRequestError } = require('../../errors/index');
const prisma = require('../../db/connect');

// Create a new post
const createPost = async (req, res) => {
  const { content, imageUrl } = req.body;
  const userId = req.user.googleId; // Changed from req.user.userId
  
  console.log("User ID from request:", userId); // Add this for debugging
  
  if (!content) {
    throw new BadRequestError('Content is required');
  }

  try {
    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        user: { connect: { googleId: userId } }
      },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true
          }
        }
      }
    });
    
    res.status(StatusCodes.CREATED).json({ post });
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

// Get all posts with pagination
const getPosts = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    // Get posts with pagination
    const posts = await prisma.post.findMany({
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalPosts = await prisma.post.count();
    const totalPages = Math.ceil(totalPosts / parseInt(limit));
    
    res.status(StatusCodes.OK).json({ 
      posts,
      currentPage: parseInt(page),
      totalPages,
      totalPosts
    });
  } catch (error) {
    console.error('Error getting posts:', error);
    throw error;
  }
};

// Get a single post by ID
const getPost = async (req, res) => {
  const { id } = req.params;
  
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                googleId: true,
                name: true,
                profileImg: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    res.status(StatusCodes.OK).json({ post });
  } catch (error) {
    console.error('Error getting post:', error);
    throw error;
  }
};

// Update a post
const updatePost = async (req, res) => {
  const { id } = req.params;
  const { content, imageUrl } = req.body;
  const userId = req.user.googleId;

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findUnique({
      where: { id }
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    if (post.userId !== userId) {
      throw new Error('You are not authorized to update this post');
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: { 
        content, 
        imageUrl 
      },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true
          }
        }
      }
    });

    res.status(StatusCodes.OK).json({ updatedPost });
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

// Delete a post
const deletePost = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.googleId;

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findUnique({
      where: { id }
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    if (post.userId !== userId) {
      throw new Error('You are not authorized to delete this post');
    }

    // Delete post (cascade will handle comments and likes)
    await prisma.post.delete({
      where: { id }
    });
    
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost
};