const axios = require("axios");
const FormData = require("form-data");

class CloudflareImageService {
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.deliveryUrl = process.env.CLOUDFLARE_IMAGE_DELIVERY_URL;
  }

  async uploadImage(imageBuffer, fileName) {
    try {
      const form = new FormData();
      form.append("file", imageBuffer, {
        filename: fileName,
        contentType: this._getMimeType(fileName),
      });

      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
        form,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            ...form.getHeaders(),
          },
        }
      );

      if (response.data.success) {
        const imageId = response.data.result.id;
        return `${this.deliveryUrl}/${imageId}/public`;
      }
      throw new Error("Failed to upload image to Cloudflare");
    } catch (error) {
      console.error(
        "Cloudflare upload error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async deleteImage(imageId) {
    try {
      const id = imageId.includes("/") ? imageId.split("/").pop() : imageId;

      const response = await axios.delete(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/${id}`,
        {
          headers: {
            // Changed: Using the correct header format
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );

      return response.data.success;
    } catch (error) {
      console.error(
        "Cloudflare delete error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async testConnection() {
    try {
      // Added: Log the request details for debugging
      console.log("Testing Cloudflare connection with:", {
        accountId: this.accountId,
        hasToken: Boolean(this.apiToken),
        tokenFirstChars: this.apiToken
          ? `${this.apiToken.substr(0, 4)}...`
          : "none",
      });

      const response = await axios.get(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
        {
          headers: {
            // Changed: Using the correct header format
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );

      if (response.data.success) {
        console.log("Cloudflare Images connection successful!");
        return true;
      }
      return false;
    } catch (error) {
      console.error(
        "Cloudflare connection test failed:",
        error.response?.data || error.message
      );
      if (error.response?.data?.errors) {
        console.error(
          "Detailed errors:",
          JSON.stringify(error.response.data.errors, null, 2)
        );
      }
      return false;
    }
  }

  _getMimeType(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    return mimeTypes[ext] || "image/jpeg";
  }
}

module.exports = new CloudflareImageService();
