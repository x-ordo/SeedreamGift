# AdminProductsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminProductsGet**](#adminproductsget) | **GET** /admin/products | 상품 목록 조회|
|[**adminProductsIdDelete**](#adminproductsiddelete) | **DELETE** /admin/products/{id} | 상품 삭제|
|[**adminProductsIdPatch**](#adminproductsidpatch) | **PATCH** /admin/products/{id} | 상품 수정|
|[**adminProductsPost**](#adminproductspost) | **POST** /admin/products | 상품 생성|

# **adminProductsGet**
> InternalApiHandlersAPIResponse adminProductsGet()


### Example

```typescript
import {
    AdminProductsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminProductsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminProductsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminProductsIdDelete**
> InternalApiHandlersAPIResponse adminProductsIdDelete()


### Example

```typescript
import {
    AdminProductsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminProductsApi(configuration);

let id: number; //상품 ID (default to undefined)

const { status, data } = await apiInstance.adminProductsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 상품 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminProductsIdPatch**
> InternalApiHandlersAPIResponse adminProductsIdPatch(body)


### Example

```typescript
import {
    AdminProductsApi,
    Configuration,
    WGiftServerInternalDomainProduct
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminProductsApi(configuration);

let id: number; //상품 ID (default to undefined)
let body: WGiftServerInternalDomainProduct; //상품 정보

const { status, data } = await apiInstance.adminProductsIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainProduct**| 상품 정보 | |
| **id** | [**number**] | 상품 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminProductsPost**
> InternalApiHandlersAPIResponse adminProductsPost(body)


### Example

```typescript
import {
    AdminProductsApi,
    Configuration,
    WGiftServerInternalDomainProduct
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminProductsApi(configuration);

let body: WGiftServerInternalDomainProduct; //상품 정보

const { status, data } = await apiInstance.adminProductsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainProduct**| 상품 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

