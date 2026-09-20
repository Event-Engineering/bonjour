import { EventEmitter } from 'node:events';

export interface AddressOptions {
    name: string;
    domain?: string;
    addresses?: string[];
}

export class Address extends EventEmitter {
    constructor(options: AddressOptions);

    name: string;
    domain: string;
    addresses: string[];

    toString(): string;
    toObject(): AddressOptions & {
        name: string;
        domain: string;
        addresses: string[];
    };
    toJSON(): ReturnType<Address['toObject']>;
}


export interface ServiceOptions {
    name: string;
    type: string;
    port: number;
    host?: string;
    addresses?: string[];
    protocol?: string;
    domain?: string;
    txt?: Record<string, string | number | boolean | Buffer>;
    txtSettings?: {
        binary?: boolean;
    };
    probe?: boolean;
}


export class Service extends EventEmitter {
    constructor(options: ServiceOptions);

    readonly name: string;
    readonly protocol: string;
    readonly domain: string;
    readonly type: string;
    readonly dn: string;
    readonly fqdn: string;
    readonly target: string;
    readonly host: string;
    readonly port: number;
    readonly referer: {
        address: string;
        family: string;
        port: number;
        size: number;
    } | undefined;

    txt: Record<string, string | number | boolean | Buffer> | undefined;
    rawTxt: Buffer[] | undefined;
    addresses: string[];

    toString(): string;

    toObject(): object;

    toJSON(): object;

    static fromFqdn(
        fqdn: string,
        otherParts?: object
    ): Service;
}

export interface BrowserOptions {
    type?: string;
    protocol?: string;
    domain?: string;
    txt?: {
        binary?: boolean;
    };
    autostart?: boolean;
}

export class Browser extends EventEmitter {
    constructor(
        mdns: unknown,
        options?: BrowserOptions,
        onup?: (service: Service) => void,
        ondown?: (service: Service) => void
    );

    readonly services: Service[];

    readonly servicesExport: object[];

    start(): void;

    stop(): void;

    update(): void;
}

export interface BonjourOptions {
    [key: string]: unknown;
}

export class Bonjour extends EventEmitter {
    constructor(options?: BonjourOptions);

    publishService(options: ServiceOptions): Service;

    publishAddress(options: AddressOptions): Address;

    isPublished(resource: Service | Address): boolean;

    unpublish(
        resource: Service | Address,
        callback?: (error?: Error | null) => void
    ): Promise<void>;

    unpublishAll(
        callback?: (error?: Error | null) => void
    ): Promise<void>;

    find(
        options?: BrowserOptions,
        onup?: (service: Service) => void,
        ondown?: (service: Service) => void
    ): Browser;

    findOne(
        options?: BrowserOptions,
        callback?: (service: Service) => void
    ): Browser;

    destroy(): void;
}

export class Registry {
    constructor(server: Server);

    publish(
        resource: Service | Address,
        probe?: boolean
    ): Service | Address;

    publishService(options: ServiceOptions): Service;

    publishAddress(options: AddressOptions): Address;

    isPublished(resource: Service | Address): boolean;

    unpublish(
        resource: Service | Address,
        callback?: (error?: Error | null) => void
    ): Promise<void>;

    unpublishAll(
        callback?: (error?: Error | null) => void
    ): Promise<void>;

    destroy(): void;
}

export class Server extends EventEmitter {
    constructor(options?: {
        ip?: string;
        port?: number;
        multicast?: boolean;
    });

    register(records: object | object[]): void;

    unregister(records: object | object[]): void;

    readonly mdns: unknown;
}

export default Bonjour;