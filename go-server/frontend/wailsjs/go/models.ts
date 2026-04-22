export namespace cron {
	
	export class JobStatus {
	    name: string;
	    schedule: string;
	    lastRun: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new JobStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.schedule = source["schedule"];
	        this.lastRun = source["lastRun"];
	        this.status = source["status"];
	    }
	}

}

export namespace gui {
	
	export class BlockedIPInfo {
	    ipAddress: string;
	    reason: string;
	    source: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BlockedIPInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ipAddress = source["ipAddress"];
	        this.reason = source["reason"];
	        this.source = source["source"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class LimitConfig {
	    perOrder: string;
	    perDay: string;
	    perMonth: string;
	    perYear: string;
	
	    static createFrom(source: any = {}) {
	        return new LimitConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.perOrder = source["perOrder"];
	        this.perDay = source["perDay"];
	        this.perMonth = source["perMonth"];
	        this.perYear = source["perYear"];
	    }
	}
	export class SecurityConfig {
	    webAuthnEnabled: boolean;
	    sessionTimeoutMin: number;
	    ipWhitelistEnabled: boolean;
	    adminIPWhitelist: string;
	    maxLoginAttempts: number;
	    lockDurationMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new SecurityConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.webAuthnEnabled = source["webAuthnEnabled"];
	        this.sessionTimeoutMin = source["sessionTimeoutMin"];
	        this.ipWhitelistEnabled = source["ipWhitelistEnabled"];
	        this.adminIPWhitelist = source["adminIPWhitelist"];
	        this.maxLoginAttempts = source["maxLoginAttempts"];
	        this.lockDurationMinutes = source["lockDurationMinutes"];
	    }
	}
	export class ServerEnvConfig {
	    port: number;
	    environment: string;
	    cookieDomain: string;
	    cookieSecure: boolean;
	    frontendURL: string;
	    adminURL: string;
	    jwtAccessExpiry: string;
	    jwtRefreshExpiry: string;
	    logLevel: string;
	    trustedProxyIPs: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerEnvConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.environment = source["environment"];
	        this.cookieDomain = source["cookieDomain"];
	        this.cookieSecure = source["cookieSecure"];
	        this.frontendURL = source["frontendURL"];
	        this.adminURL = source["adminURL"];
	        this.jwtAccessExpiry = source["jwtAccessExpiry"];
	        this.jwtRefreshExpiry = source["jwtRefreshExpiry"];
	        this.logLevel = source["logLevel"];
	        this.trustedProxyIPs = source["trustedProxyIPs"];
	    }
	}
	export class ServerStatus {
	    version: string;
	    goVersion: string;
	    goroutines: number;
	    heapAlloc: number;
	    heapSys: number;
	    totalAlloc: number;
	    numGC: number;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.goVersion = source["goVersion"];
	        this.goroutines = source["goroutines"];
	        this.heapAlloc = source["heapAlloc"];
	        this.heapSys = source["heapSys"];
	        this.totalAlloc = source["totalAlloc"];
	        this.numGC = source["numGC"];
	    }
	}
	export class SessionInfo {
	    id: number;
	    userId: number;
	    userEmail: string;
	    userAgent: string;
	    ipAddress: string;
	    createdAt: string;
	    expiresAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.userId = source["userId"];
	        this.userEmail = source["userEmail"];
	        this.userAgent = source["userAgent"];
	        this.ipAddress = source["ipAddress"];
	        this.createdAt = source["createdAt"];
	        this.expiresAt = source["expiresAt"];
	    }
	}
	export class StockAlert {
	    productId: number;
	    productName: string;
	    brandCode: string;
	    available: number;
	    threshold: number;
	
	    static createFrom(source: any = {}) {
	        return new StockAlert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.brandCode = source["brandCode"];
	        this.available = source["available"];
	        this.threshold = source["threshold"];
	    }
	}

}

export namespace monitor {
	
	export class HistoryPoint {
	    timestamp: number;
	    cpuUsage: number;
	    memoryUsage: number;
	    goroutines: number;
	    requestRate: number;
	    errorRate: number;
	
	    static createFrom(source: any = {}) {
	        return new HistoryPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.cpuUsage = source["cpuUsage"];
	        this.memoryUsage = source["memoryUsage"];
	        this.goroutines = source["goroutines"];
	        this.requestRate = source["requestRate"];
	        this.errorRate = source["errorRate"];
	    }
	}
	export class Stats {
	    uptime: string;
	    cpuUsage: number;
	    memoryUsage: number;
	    systemMemoryUsage: number;
	    goroutineCount: number;
	    requestRate: number;
	    errorRate: number;
	    dbConnections: number;
	
	    static createFrom(source: any = {}) {
	        return new Stats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uptime = source["uptime"];
	        this.cpuUsage = source["cpuUsage"];
	        this.memoryUsage = source["memoryUsage"];
	        this.systemMemoryUsage = source["systemMemoryUsage"];
	        this.goroutineCount = source["goroutineCount"];
	        this.requestRate = source["requestRate"];
	        this.errorRate = source["errorRate"];
	        this.dbConnections = source["dbConnections"];
	    }
	}

}

