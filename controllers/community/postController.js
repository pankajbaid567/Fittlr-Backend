const { StatusCodes } = require("http-status-codes");
const { NotFoundError, BadRequestError } = require("../../errors/index");
const prisma = require("../../db/connect");
const cloudflareImageService = require("../../services/cloudflare");

// Create a new post
const createPost = async (req, res) => {
  const { content, userId } = req.body;
  // const userId = req.user.googleId;

  console.log("User ID from request:", userId);

  if (!content) {
    throw new BadRequestError("Content is required");
  }

  try {
    let imageUrl = null;

    // Process image if it exists
    if (req.file) {
      // Check if Cloudflare credentials are properly configured
      if (
        !process.env.CLOUDFLARE_ACCOUNT_ID ||
        !process.env.CLOUDFLARE_API_TOKEN
      ) {
        console.warn(
          "Cloudflare credentials missing. Image upload will be skipped."
        );

        // Save post without image if Cloudflare is not configured
        const post = await prisma.post.create({
          data: {
            content,
            imageUrl: null,
            user: { connect: { googleId: userId } },
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

        return res.status(StatusCodes.CREATED).json({
          post,
          warning:
            "Image was not uploaded due to missing Cloudflare configuration.",
        });
      }

      const imageBuffer = req.file.buffer;
      const fileName = `post_${Date.now()}_${req.file.originalname}`;

      // Upload to Cloudflare and get URL
      imageUrl = await cloudflareImageService.uploadImage(
        imageBuffer,
        fileName
      );
    }

    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        user: { connect: { googleId: userId } },
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

    res.status(StatusCodes.CREATED).json({ post });
  } catch (error) {
    console.error("Error creating post:", error);

    // Create post without image if Cloudflare upload fails
    if (
      error.message?.includes("Cloudflare upload error") ||
      error.code === "ERR_BAD_REQUEST"
    ) {
      try {
        const post = await prisma.post.create({
          data: {
            content,
            imageUrl: null,
            user: { connect: { googleId: userId } },
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

        return res.status(StatusCodes.CREATED).json({
          post,
          warning:
            "Image upload failed, but post was created without an image.",
        });
      } catch (innerError) {
        console.error("Error creating post without image:", innerError);
        throw innerError;
      }
    }

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
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            googleId: true,
            name: true,
            profileImg: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    // Get total count for pagination
    const totalPosts = await prisma.post.count();
    const totalPages = Math.ceil(totalPosts / parseInt(limit));

    res.status(StatusCodes.OK).json({
      posts,
      currentPage: parseInt(page),
      totalPages,
      totalPosts,
    });
  } catch (error) {
    console.error("Error getting posts:", error);
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
            profileImg: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                googleId: true,
                name: true,
                profileImg: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    res.status(StatusCodes.OK).json({ post });
  } catch (error) {
    console.error("Error getting post:", error);
    throw error;
  }
};

// Update a post
const updatePost = async (req, res) => {
  const { id } = req.params;
  const { content, userId } = req.body;
  // const userId = req.user.googleId; // Comment out this line

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    if (post.userId !== userId) {
      throw new Error("You are not authorized to update this post");
    }

    let imageUrl = post.imageUrl;

    // If there's a new image, upload it and update the URL
    if (req.file) {
      // Delete previous image if it exists
      if (post.imageUrl) {
        try {
          await cloudflareImageService.deleteImage(post.imageUrl);
        } catch (err) {
          console.error("Error deleting previous image:", err);
          // Continue even if delete fails
        }
      }

      const imageBuffer = req.file.buffer;
      const fileName = `post_${Date.now()}_${req.file.originalname}`;

      // Upload to Cloudflare and get URL
      imageUrl = await cloudflareImageService.uploadImage(
        imageBuffer,
        fileName
      );
    }

    // If imageUrl is explicitly set to null in request, remove the image
    if (req.body.removeImage === "true" && post.imageUrl) {
      try {
        await cloudflareImageService.deleteImage(post.imageUrl);
      } catch (err) {
        console.error("Error deleting image on removal:", err);
      }
      imageUrl = null;
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content,
        imageUrl,
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

    res.status(StatusCodes.OK).json({ updatedPost });
  } catch (error) {
    console.error("Error updating post:", error);
    throw error;
  }
};

// Delete a post
const deletePost = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  // const userId = req.user.googleId; // Comment out this line

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    if (post.userId !== userId) {
      throw new Error("You are not authorized to delete this post");
    }

    // Delete image from Cloudflare if it exists
    if (post.imageUrl) {
      try {
        await cloudflareImageService.deleteImage(post.imageUrl);
      } catch (err) {
        console.error("Error deleting image on post deletion:", err);
        // Continue with post deletion even if image deletion fails
      }
    }

    // Delete post (cascade will handle comments and likes)
    await prisma.post.delete({
      where: { id },
    });

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
};
