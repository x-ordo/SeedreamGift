# UpdateTradeInStatusDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **string** | 변경할 매입 상태 | [default to undefined]
**reason** | **string** | 거절 사유 (REJECTED 시 필수 권장) | [optional] [default to undefined]

## Example

```typescript
import { UpdateTradeInStatusDto } from './api';

const instance: UpdateTradeInStatusDto = {
    status,
    reason,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
