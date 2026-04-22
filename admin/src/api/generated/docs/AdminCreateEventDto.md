# AdminCreateEventDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | 이벤트 제목 | [default to undefined]
**description** | **string** | 이벤트 설명 | [default to undefined]
**imageUrl** | **string** | 이벤트 이미지 URL | [optional] [default to undefined]
**startDate** | **string** | 이벤트 시작일 | [default to undefined]
**endDate** | **string** | 이벤트 종료일 | [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to undefined]
**isFeatured** | **boolean** | 메인 노출 여부 | [optional] [default to undefined]

## Example

```typescript
import { AdminCreateEventDto } from './api';

const instance: AdminCreateEventDto = {
    title,
    description,
    imageUrl,
    startDate,
    endDate,
    isActive,
    isFeatured,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
