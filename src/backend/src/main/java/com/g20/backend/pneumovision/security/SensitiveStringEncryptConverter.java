package com.g20.backend.pneumovision.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.stereotype.Component;

@Component
@Converter(autoApply = false)
public class SensitiveStringEncryptConverter implements AttributeConverter<String, String> {

    private final FieldEncryptor fieldEncryptor;

    public SensitiveStringEncryptConverter(FieldEncryptor fieldEncryptor) {
        this.fieldEncryptor = fieldEncryptor;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return fieldEncryptor.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return fieldEncryptor.decrypt(dbData);
    }
}