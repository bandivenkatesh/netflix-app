package com.example.netflixapp.service;

import com.example.netflixapp.model.Movie;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;

@Service
public class MovieService {
    private final List<Movie> movies;

    public MovieService() throws IOException {
        ObjectMapper objectMapper = new ObjectMapper();
        try (InputStream inputStream = new ClassPathResource("movies.json").getInputStream()) {
            movies = objectMapper.readValue(inputStream, new TypeReference<>() {});
        }
    }

    public List<Movie> listMovies() {
        return movies;
    }

    public Optional<Movie> getMovieById(String id) {
        return movies.stream().filter(movie -> movie.getId().equals(id)).findFirst();
    }
}
