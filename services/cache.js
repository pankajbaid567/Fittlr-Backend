const NodeCache = require("node-cache");
const prisma = require("../db/connect");

class CacheService {
  constructor() {
    // Reduce TTL to 600 seconds (10 minutes) and increase check period
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 300,
      useClones: false, // Disable cloning for better performance
      maxKeys: 1000, // Limit maximum cache entries
    });
    // Define cache keys as instance properties
    this.CACHE_KEYS = {
      ADMIN_LIST: "admin_list_",
      CONSUMER_LIST: "consumer_list_",
      CONTENT_CREATOR_LIST: "content_creator_list_",
      VALIDATOR_LIST: "validator_list_",
      HOME_PAGE: "home_page_counts",
    };
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl = 900) {
    return this.cache.set(key, value, ttl);
  }

  del(key) {
    if (key instanceof RegExp) {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter((k) => key.test(k));
      matchingKeys.forEach((k) => this.cache.del(k));
      return matchingKeys.length;
    }
    return this.cache.del(key);
  }

  flush() {
    return this.cache.flushAll();
  }

  getUserListCacheKey(userType, page, limit) {
    return `${userType}${page}_${limit}`;
  }

  async warmUp() {
    try {
      console.log("Warming up cache...");

      // Clear existing cache
      this.flush();

      // Fetch initial data
      const [
        adminCount,
        consumerCount,
        creatorCount,
        categoryCount,
        tagCount,
        capsuleCount,
        categories,
      ] = await Promise.all([
        prisma.user.count({ where: { isAdmin: true } }),
        prisma.user.count({ where: { isConsumer: true } }),
        prisma.user.count({ where: { isContent_creator: true } }),
        prisma.category.count(),
        prisma.tag.count(),
        prisma.knowledge_capsule.count(),
        prisma.category.findMany({
          select: { id: true, name: true },
        }),
      ]);

      // Cache homepage data
      this.set(this.CACHE_KEYS.HOME_PAGE, {
        admin_count: adminCount,
        consumer_count: consumerCount,
        content_creator_count: creatorCount,
        category_count: categoryCount,
        tag_count: tagCount,
        knowledge_capsule_count: capsuleCount,
        categories,
      });

      console.log("Cache warm-up completed successfully");
      return true;
    } catch (error) {
      console.error("Cache warm-up failed:", error);
      return false;
    }
  }
}

module.exports = new CacheService();
