package com.g20.backend.pneumovision.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableRabbit
public class RabbitMqConfig {

    @Value("${inference.queue.exchange}")
    private String exchangeName;

    @Value("${inference.queue.routing-key}")
    private String routingKey;

    @Value("${inference.queue.name}")
    private String queueName;
    @Value("${inference.queue.dead-letter-exchange}")
    private String deadLetterExchangeName;
    @Value("${inference.queue.dead-letter-routing-key}")
    private String deadLetterRoutingKey;
    @Value("${inference.queue.dead-letter-name}")
    private String deadLetterQueueName;

    @Bean
    public DirectExchange inferenceExchange() {
        return new DirectExchange(exchangeName, true, false);
    }

    @Bean
    public Queue inferenceQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", deadLetterExchangeName);
        args.put("x-dead-letter-routing-key", deadLetterRoutingKey);
        return new Queue(queueName, true, false, false, args);
    }

    @Bean
    public Binding inferenceBinding(Queue inferenceQueue, DirectExchange inferenceExchange) {
        return BindingBuilder.bind(inferenceQueue).to(inferenceExchange).with(routingKey);
    }

    @Bean
    public DirectExchange inferenceDeadLetterExchange() {
        return new DirectExchange(deadLetterExchangeName, true, false);
    }

    @Bean
    public Queue inferenceDeadLetterQueue() {
        return new Queue(deadLetterQueueName, true);
    }

    @Bean
    public Binding inferenceDeadLetterBinding(Queue inferenceDeadLetterQueue, DirectExchange inferenceDeadLetterExchange) {
        return BindingBuilder.bind(inferenceDeadLetterQueue).to(inferenceDeadLetterExchange).with(deadLetterRoutingKey);
    }

    @Bean
    public MessageConverter rabbitMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
