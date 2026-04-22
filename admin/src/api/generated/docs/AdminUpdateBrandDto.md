# AdminUpdateBrandDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | 브랜드 이름 | [optional] [default to undefined]
**color** | **string** | 브랜드 색상 (HEX) | [optional] [default to undefined]
**order** | **number** | 표시 순서 | [optional] [default to undefined]
**description** | **string** | 브랜드 설명 | [optional] [default to undefined]
**imageUrl** | **string** | 브랜드 이미지 URL | [optional] [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to undefined]
**pinConfig** | **object** | PIN 코드 설정 (JSON) | [optional] [default to undefined]

## Example

```typescript
import { AdminUpdateBrandDto } from './api';

const instance: AdminUpdateBrandDto = {
    name,
    color,
    order,
    description,
    imageUrl,
    isActive,
    pinConfig,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
