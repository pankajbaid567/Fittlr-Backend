const NodeCache = require("node-cache");

class CacheService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 1000, checkperiod: 120 }); // 15 minutes default TTL
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
}

module.exports = new CacheService();
