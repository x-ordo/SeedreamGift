# AdminCreateBrandDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**code** | **string** | 브랜드 코드 (Primary Key) | [default to undefined]
**name** | **string** | 브랜드 이름 | [default to undefined]
**color** | **string** | 브랜드 색상 (HEX) | [optional] [default to undefined]
**order** | **number** | 표시 순서 | [optional] [default to undefined]
**description** | **string** | 브랜드 설명 | [optional] [default to undefined]
**imageUrl** | **string** | 브랜드 이미지 URL | [optional] [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to undefined]
**pinConfig** | **object** | PIN 코드 설정 (JSON) | [optional] [default to undefined]

## Example

```typescript
import { AdminCreateBrandDto } from './api';

const instance: AdminCreateBrandDto = {
    code,
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
