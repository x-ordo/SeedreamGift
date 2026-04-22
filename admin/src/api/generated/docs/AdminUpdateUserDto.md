# AdminUpdateUserDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | 사용자 이름 | [optional] [default to undefined]
**phone** | **string** | 전화번호 | [optional] [default to undefined]
**role** | **string** | 사용자 역할 | [optional] [default to undefined]
**kycStatus** | **string** | KYC 상태 | [optional] [default to undefined]
**canReceiveGift** | **boolean** | 선물 받기 허용 여부 | [optional] [default to undefined]
**customLimitPerTx** | **number** | 건당 한도 (원) | [optional] [default to undefined]
**customLimitPerDay** | **number** | 일일 한도 (원) | [optional] [default to undefined]

## Example

```typescript
import { AdminUpdateUserDto } from './api';

const instance: AdminUpdateUserDto = {
    name,
    phone,
    role,
    kycStatus,
    canReceiveGift,
    customLimitPerTx,
    customLimitPerDay,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
