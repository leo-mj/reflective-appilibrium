def test_test_endpoint_returns_ok(client, mock_llm_complete):
    res = client.post("/api/llm/test", headers={
        "x-api-key": "user-key",
        "x-base-url": "https://api.openai.com/v1",
        "x-model": "gpt-4o-mini",
    })
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "model": "gpt-4o-mini"}


def test_test_endpoint_uses_byok_model(client, mock_llm_complete):
    res = client.post("/api/llm/test", headers={
        "x-api-key": "user-key",
        "x-base-url": "https://api.openai.com/v1",
        "x-model": "gpt-4o",
    })
    assert res.json()["model"] == "gpt-4o"


def test_test_endpoint_falls_back_to_server_api_key(client, mock_llm_complete):
    # No x-api-key — should fall back to the server-side key from fake_settings.
    res = client.post("/api/llm/test", headers={
        "x-base-url": "https://api.openai.com/v1",
    })
    assert res.status_code == 200
    assert res.json()["model"] == "gpt-4o-mini"  # default_model from fake_settings


def test_rejects_unknown_base_url(client, mock_llm_complete):
    res = client.post("/api/llm/test", headers={
        "x-api-key": "user-key",
        "x-base-url": "https://evil.com/v1",
    })
    assert res.status_code == 400


def test_complete_uses_byok_key(client, mock_llm_complete):
    res = client.post("/api/llm/complete", json={
        "messages": [{"role": "user", "content": "hello"}],
    }, headers={"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1", "x-model": "gpt-4o"})
    assert res.status_code == 200
    call_kwargs = mock_llm_complete.call_args.kwargs
    assert call_kwargs["api_key"] == "user-key"
