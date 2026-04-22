# CartApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**cartBatchDelete**](#cartbatchdelete) | **DELETE** /cart/batch | 장바구니 상품 일괄 삭제|
|[**cartCheckLimitGet**](#cartchecklimitget) | **GET** /cart/check-limit | 장바구니 구매 한도 확인|
|[**cartGet**](#cartget) | **GET** /cart | 장바구니 조회|
|[**cartIdDelete**](#cartiddelete) | **DELETE** /cart/{id} | 장바구니 상품 삭제|
|[**cartIdPatch**](#cartidpatch) | **PATCH** /cart/{id} | 장바구니 상품 수량 변경|
|[**cartPost**](#cartpost) | **POST** /cart | 장바구니에 상품 추가|

# **cartBatchDelete**
> InternalApiHandlersAPIResponse cartBatchDelete(body)


### Example

```typescript
import {
    CartApi,
    Configuration,
    InternalApiHandlersCartBatchRemoveRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

let body: InternalApiHandlersCartBatchRemoveRequest; //삭제할 상품 ID 목록

const { status, data } = await apiInstance.cartBatchDelete(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersCartBatchRemoveRequest**| 삭제할 상품 ID 목록 | |


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

# **cartCheckLimitGet**
> InternalApiHandlersAPIResponse cartCheckLimitGet()


### Example

```typescript
import {
    CartApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

const { status, data } = await apiInstance.cartCheckLimitGet();
```

### Parameters
This endpoint does not have any parameters.


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cartGet**
> InternalApiHandlersAPIResponse cartGet()


### Example

```typescript
import {
    CartApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

const { status, data } = await apiInstance.cartGet();
```

### Parameters
This endpoint does not have any parameters.


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cartIdDelete**
> InternalApiHandlersAPIResponse cartIdDelete()


### Example

```typescript
import {
    CartApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

let id: number; //장바구니 항목 ID (default to undefined)

const { status, data } = await apiInstance.cartIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 장바구니 항목 ID | defaults to undefined|


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

# **cartIdPatch**
> InternalApiHandlersAPIResponse cartIdPatch(body)


### Example

```typescript
import {
    CartApi,
    Configuration,
    InternalApiHandlersCartUpdateQuantityRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

let id: number; //장바구니 항목 ID (default to undefined)
let body: InternalApiHandlersCartUpdateQuantityRequest; //변경할 수량

const { status, data } = await apiInstance.cartIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersCartUpdateQuantityRequest**| 변경할 수량 | |
| **id** | [**number**] | 장바구니 항목 ID | defaults to undefined|


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

# **cartPost**
> InternalApiHandlersAPIResponse cartPost(body)


### Example

```typescript
import {
    CartApi,
    Configuration,
    InternalApiHandlersCartAddItemRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CartApi(configuration);

let body: InternalApiHandlersCartAddItemRequest; //추가할 상품 정보

const { status, data } = await apiInstance.cartPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersCartAddItemRequest**| 추가할 상품 정보 | |


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

