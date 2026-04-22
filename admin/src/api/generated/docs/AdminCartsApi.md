# AdminCartsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminCartsGet**](#admincartsget) | **GET** /admin/carts | 전체 장바구니 목록 조회|
|[**adminCartsIdDelete**](#admincartsiddelete) | **DELETE** /admin/carts/{id} | 장바구니 항목 삭제|
|[**adminCartsUserUserIdAllDelete**](#admincartsuseruseridalldelete) | **DELETE** /admin/carts/user/{userId}/all | 회원 장바구니 전체 비우기|
|[**adminCartsUserUserIdGet**](#admincartsuseruseridget) | **GET** /admin/carts/user/{userId} | 회원 장바구니 조회|

# **adminCartsGet**
> InternalApiHandlersAPIResponse adminCartsGet()


### Example

```typescript
import {
    AdminCartsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminCartsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminCartsGet(
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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminCartsIdDelete**
> InternalApiHandlersAPIResponse adminCartsIdDelete()


### Example

```typescript
import {
    AdminCartsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminCartsApi(configuration);

let id: number; //장바구니 항목 ID (default to undefined)

const { status, data } = await apiInstance.adminCartsIdDelete(
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

# **adminCartsUserUserIdAllDelete**
> InternalApiHandlersAPIResponse adminCartsUserUserIdAllDelete()


### Example

```typescript
import {
    AdminCartsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminCartsApi(configuration);

let userId: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminCartsUserUserIdAllDelete(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 회원 ID | defaults to undefined|


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

# **adminCartsUserUserIdGet**
> InternalApiHandlersAPIResponse adminCartsUserUserIdGet()


### Example

```typescript
import {
    AdminCartsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminCartsApi(configuration);

let userId: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminCartsUserUserIdGet(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 회원 ID | defaults to undefined|


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

