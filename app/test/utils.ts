import { Response } from 'express';

// Mock express response
class MockedExpressResponse {
    statusCalledTimes = 0;
    statusLastValue: any;
    sendCalledTimes = 0;
    sendLastValue: any;
    jsonCalledTimes = 0;
    jsonLastValue: any;
    headerCalledTimes = 0;
    headerLastKey: any;
    headerLastValue: any;
    setCalledTimes = 0;
    setLastKey?: string;
    setLastValue?: string;

    set(key: string, value: string) {
        this.setCalledTimes++;
        this.setLastKey = key;
        this.setLastValue = value;
    }

    header(key: string, value: string) {
        this.headerCalledTimes++;
        this.headerLastKey = key;
        this.headerLastValue = value;
        return this;
    }

    status(value: any) {
        this.statusCalledTimes++;
        this.statusLastValue = value;
        return this;
    }

    send(value: any) {
        this.sendCalledTimes++;
        this.sendLastValue = value;
    }

    json(value: any) {
        this.jsonCalledTimes++;
        this.jsonLastValue = value;
    }

    mockReset() {
        this.statusCalledTimes = 0;
        this.statusLastValue = undefined;
        this.sendCalledTimes = 0;
        this.sendLastValue = undefined;
        this.jsonCalledTimes = 0;
        this.jsonLastValue = undefined;
        this.headerCalledTimes = 0;
        this.headerLastKey = undefined;
        this.headerLastValue = undefined;
        this.setCalledTimes = 0;
        this.setLastKey = undefined;
        this.setLastValue = undefined;
    }
}

export const expressResponseMock: Response & MockedExpressResponse = new MockedExpressResponse() as any;
